import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { extractEpisodeRows, syncEpisodes } from '@/lib/episodes';

// 15 MB cap on the JSON payload — rawRows blobs can be large, but unbounded
// bodies were accepted verbatim before.
const MAX_BODY_BYTES = 15 * 1024 * 1024;

const PostSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  dashboard: z.record(z.string(), z.unknown()).nullish(),
  location: z.record(z.string(), z.unknown()).nullish(),
  claims: z.record(z.string(), z.unknown()).nullish(),
  datasets: z.record(z.string(), z.unknown()).nullish(),
  uploads: z.array(z.unknown()).nullish(),
  processedHashes: z.array(z.string()).nullish(),
  /** Optimistic lock: reject the write if the record changed after this time. */
  ifUnmodifiedSince: z.string().nullish(),
});

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
              updatedAt: record.updatedAt.toISOString(),
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
        updatedAt: r.updatedAt.toISOString(),
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

    const rawBody = await request.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = PostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map((i) => i.message) },
        { status: 400 }
      );
    }
    const { year, dashboard, location, claims, datasets, uploads, processedHashes, ifUnmodifiedSince } = parsed.data;

    const orgId = user.orgId;

    // Fetch existing record once: needed for both the optimistic lock and the
    // processedHashes set-union.
    const existing = await prisma.yearDataRecord.findUnique({
      where: { year_orgId: { year, orgId } },
      select: { processedHashes: true, updatedAt: true },
    });

    // Optimistic lock: if the caller tells us what version it based its write
    // on and the record has moved since, refuse rather than clobber.
    if (ifUnmodifiedSince && existing) {
      const base = new Date(ifUnmodifiedSince);
      if (!Number.isNaN(base.getTime()) && existing.updatedAt.getTime() > base.getTime()) {
        return NextResponse.json(
          {
            error: 'Conflict: record was modified by another writer',
            updatedAt: existing.updatedAt.toISOString(),
          },
          { status: 409 }
        );
      }
    }

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
        dashboard: (dashboard ?? undefined) as Prisma.InputJsonValue | undefined,
        location: (location ?? undefined) as Prisma.InputJsonValue | undefined,
        claims: (claims ?? undefined) as Prisma.InputJsonValue | undefined,
        datasets: (datasets ?? {}) as Prisma.InputJsonValue,
        uploads: (uploads ?? []) as Prisma.InputJsonValue,
        processedHashes: mergedHashes ?? (processedHashes ?? []),
      },
      update: updateData,
    });

    // Phase-1 relational model: dual-write Location episodes into the
    // normalized `episodes` table (idempotent; skeleton rows are skipped).
    if (location) {
      try {
        const rawRows = (location as { rawRows?: Record<string, unknown>[] }).rawRows;
        const rows = extractEpisodeRows(rawRows, orgId, year, null);
        if (rows.length > 0) {
          const synced = await syncEpisodes(rows);
          if (synced.inserted > 0) {
            console.log(`[API /data POST] Episodes synced: +${synced.inserted} rows`);
          }
        }
      } catch (episodeError) {
        console.warn('[API /data POST] Episode sync failed (non-fatal):', episodeError);
      }
    }

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
      updatedAt: record.updatedAt.toISOString(),
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

    if (yearParam === 'all') {
      await prisma.yearDataRecord.deleteMany({
        where: { orgId: user.orgId },
      });

      await prisma.auditLog.create({
        data: {
          action: 'DATA_DELETE',
          category: 'Dashboard',
          details: 'Deleted all data for organization',
          userId: session.user.id,
          userName: session.user.name || session.user.email || 'Unknown',
          orgId: user.orgId,
          ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
          metadata: { target: 'all' }
        }
      });

      return NextResponse.json({ success: true, deleted: 'all' });
    }

    const year = parseInt(yearParam, 10);
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

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
