import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

// Force this route to be fully dynamic so no caching layer ever
// returns stale year_data after a watcher write.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/data?year=2026&orgId=xxx
 * Fetch a year's data for the user's organization.
 * If no year param, returns all years.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the user's orgId
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true },
    });

    if (!user?.orgId) {
      return NextResponse.json({ error: 'No organization assigned' }, { status: 403 });
    }

    const orgId = user.orgId;
    const searchParams = request.nextUrl.searchParams;
    const yearParam = searchParams.get('year');

    if (yearParam) {
      const year = parseInt(yearParam, 10);
      if (isNaN(year) || year < 2020 || year > 2035) {
        return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
      }

      const record = await prisma.yearDataRecord.findUnique({
        where: { year_orgId: { year, orgId } },
      });

      return NextResponse.json({
        success: true,
        data: record
          ? {
              year: record.year,
              dashboard: record.dashboard,
              location: record.location,
              claims: record.claims,
              datasets: record.datasets,
              uploads: record.uploads,
              processedHashes: record.processedHashes,
            }
          : null,
      });
    }

    // Return all years for this org
    const records = await prisma.yearDataRecord.findMany({
      where: { orgId },
      orderBy: { year: 'desc' },
    });

    const years: Record<number, object> = {};
    for (const r of records) {
      years[r.year] = {
        year: r.year,
        dashboard: r.dashboard,
        location: r.location,
        claims: r.claims,
        datasets: r.datasets,
        uploads: r.uploads,
        processedHashes: r.processedHashes,
      };
    }

    return NextResponse.json({
      success: true,
      data: years,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[API /data GET] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/data
 * Upsert a year's data. Body: { year, dashboard?, location?, claims?, datasets?, uploads?, processedHashes? }
 * Uses upsert so it works for both first upload and updates.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true, role: true },
    });

    if (!user?.orgId) {
      return NextResponse.json({ error: 'No organization assigned' }, { status: 403 });
    }

    // Only ADMIN and ANALYST can write data
    if (user.role === 'VIEWER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { year, dashboard, location, claims, datasets, uploads, processedHashes } = body;

    if (!year || typeof year !== 'number') {
      return NextResponse.json({ error: 'Year is required' }, { status: 400 });
    }

    const orgId = user.orgId;

    const updateData: Prisma.YearDataRecordUpdateInput = {
      updatedAt: new Date(),
    };
    if (dashboard) updateData.dashboard = dashboard as Prisma.InputJsonValue;
    if (location) updateData.location = location as Prisma.InputJsonValue;
    if (claims) updateData.claims = claims as Prisma.InputJsonValue;
    if (datasets) updateData.datasets = datasets as Prisma.InputJsonValue;
    if (uploads) updateData.uploads = uploads as Prisma.InputJsonValue;
    // processedHashes is the file-hash dedup index. Treat as set-union, never
    // as replace - a client that doesn't know about a hash must not be able
    // to remove it. The watcher and previous browser uploads contribute hashes;
    // any one of those should be enough to short-circuit a re-ingest.
    let mergedHashes: string[] | undefined;
    if (Array.isArray(processedHashes)) {
      const existing = await prisma.yearDataRecord.findUnique({
        where: { year_orgId: { year, orgId } },
        select: { processedHashes: true },
      });
      mergedHashes = Array.from(
        new Set([...(existing?.processedHashes ?? []), ...processedHashes])
      );
      updateData.processedHashes = mergedHashes;
    }

    const record = await prisma.yearDataRecord.upsert({
      where: { year_orgId: { year, orgId } },
      create: {
        year,
        orgId,
        dashboard: dashboard ?? undefined,
        location: location ?? undefined,
        claims: claims ?? undefined,
        datasets: datasets ?? {},
        uploads: uploads ?? [],
        processedHashes: mergedHashes ?? (processedHashes ?? []),
      },
      update: updateData,
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'DATA_WRITE',
        category: 'Dashboard',
        details: `Updated data for year ${year}`,
        userId: session.user.id,
        userName: session.user.name || session.user.email || 'Unknown',
        orgId: orgId,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: { year }
      }
    });

    return NextResponse.json({
      success: true,
      year: record.year,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    console.error('[API /data POST] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/data?year=2026
 * Delete a year's data for the org. Admin only.
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true, role: true },
    });

    if (!user?.orgId || user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const yearParam = request.nextUrl.searchParams.get('year');
    if (!yearParam) {
      return NextResponse.json({ error: 'Year parameter required' }, { status: 400 });
    }

    const year = parseInt(yearParam, 10);

    await prisma.yearDataRecord.deleteMany({
      where: { year, orgId: user.orgId },
    });

    // Create Audit Log
    await prisma.auditLog.create({
      data: {
        action: 'DATA_DELETE',
        category: 'Dashboard',
        details: `Deleted data for year ${year}`,
        userId: session.user.id,
        userName: session.user.name || session.user.email || 'Unknown',
        orgId: user.orgId,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: { year }
      }
    });

    return NextResponse.json({ success: true, deleted: year });
  } catch (error) {
    console.error('[API /data DELETE] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
