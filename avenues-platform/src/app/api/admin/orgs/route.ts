import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/orgs
 *
 * Returns all organizations. Authenticated via the same INGEST_API_KEY
 * used by the file watcher, so you can curl it from anywhere.
 *
 * Usage:
 *   curl -H "X-API-Key: YOUR_KEY" https://mil-analytics-dashboard.vercel.app/api/admin/orgs
 */
export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== process.env.INGEST_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      success: true,
      orgs: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        createdAt: o.createdAt,
        userCount: o._count.users,
      })),
    });
  } catch (error) {
    console.error('[API /admin/orgs] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
