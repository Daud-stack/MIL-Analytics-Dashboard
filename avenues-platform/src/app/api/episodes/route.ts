import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/episodes?year=2026&groupBy=month|doctor|medAid|ward|specialty|icdCode|cptCode|ageGroup|gender
 *
 * SQL-side aggregation over the normalized `episodes` table (phase 1 of the
 * relational data model). Returns { groups: [{ key, episodes, revenue, avgLos }] }.
 * Add &month=0..11 to filter to a single month.
 */

const GROUPABLE = new Set([
  'month', 'doctor', 'medAid', 'ward', 'specialty', 'icdCode', 'cptCode', 'ageGroup', 'gender',
] as const);

type GroupField = 'month' | 'doctor' | 'medAid' | 'ward' | 'specialty' | 'icdCode' | 'cptCode' | 'ageGroup' | 'gender';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { orgId: true },
    });
    if (!user?.orgId) {
      return NextResponse.json({ error: 'No organization assigned' }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const year = parseInt(params.get('year') || '', 10);
    if (Number.isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Valid year parameter required' }, { status: 400 });
    }

    const groupByParam = (params.get('groupBy') || 'month') as GroupField;
    if (!GROUPABLE.has(groupByParam)) {
      return NextResponse.json(
        { error: `groupBy must be one of: ${Array.from(GROUPABLE).join(', ')}` },
        { status: 400 }
      );
    }

    const where: { orgId: string; year: number; month?: number } = {
      orgId: user.orgId,
      year,
    };
    const monthParam = params.get('month');
    if (monthParam !== null) {
      const month = parseInt(monthParam, 10);
      if (!Number.isNaN(month) && month >= 0 && month <= 11) where.month = month;
    }

    const grouped = await prisma.episode.groupBy({
      by: [groupByParam],
      where,
      _count: { _all: true },
      _sum: { revenue: true },
      _avg: { los: true },
      orderBy: { _sum: { revenue: 'desc' } },
      take: 200,
    });

    const totals = await prisma.episode.aggregate({
      where,
      _count: { _all: true },
      _sum: { revenue: true },
      _avg: { los: true },
    });

    return NextResponse.json({
      year,
      groupBy: groupByParam,
      totals: {
        episodes: totals._count._all,
        revenue: totals._sum.revenue ?? 0,
        avgLos: totals._avg.los,
      },
      groups: grouped.map((g) => ({
        key: (g as Record<string, unknown>)[groupByParam] ?? null,
        episodes: g._count._all,
        revenue: g._sum.revenue ?? 0,
        avgLos: g._avg.los,
      })),
    });
  } catch (error) {
    console.error('[API /episodes] Error:', error);
    return NextResponse.json({ error: 'Failed to aggregate episodes' }, { status: 500 });
  }
}
