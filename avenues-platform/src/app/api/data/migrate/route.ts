import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/data/migrate
 * One-time migration: push all localStorage YearData to the DB.
 * Body: { years: { [year: number]: YearData } }
 *
 * Only writes data for years that DON'T already exist in the DB,
 * so it's safe to call multiple times (idempotent).
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

    if (user.role === 'VIEWER') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const { years } = body as { years: Record<string, Record<string, unknown>> };

    if (!years || typeof years !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const orgId = user.orgId;
    let migrated = 0;
    let skipped = 0;

    for (const [yearStr, data] of Object.entries(years)) {
      const year = parseInt(yearStr, 10);
      if (isNaN(year)) continue;

      // Check if DB already has data for this year+org
      const existing = await prisma.yearDataRecord.findUnique({
        where: { year_orgId: { year, orgId } },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Insert the localStorage data
      await prisma.yearDataRecord.create({
        data: {
          year,
          orgId,
          dashboard: (data.dashboard ?? data.dash ?? null) as object | null,
          location: (data.location ?? data.loc ?? null) as object | null,
          claims: (data.claims ?? data.apac ?? null) as object | null,
          datasets: (data.datasets ?? {}) as object,
          uploads: (data.uploads ?? []) as object,
          processedHashes: [],
        },
      });
      migrated++;
    }

    return NextResponse.json({
      success: true,
      migrated,
      skipped,
      message: `Migrated ${migrated} year(s) to database. ${skipped} already existed.`,
    });
  } catch (error) {
    console.error('[API /data/migrate] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}
