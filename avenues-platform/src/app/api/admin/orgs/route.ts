import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/admin/orgs
 *
 * Returns all organizations. Authenticated via session (ADMIN role)
 * or INGEST_API_KEY for M2M access.
 *
 * Usage:
 *   curl -H "X-API-Key: YOUR_KEY" https://mil-analytics-dashboard.vercel.app/api/admin/orgs
 */
export async function GET(request: NextRequest) {
  try {
    // Auth: require ADMIN session OR valid API key
    const session = await auth();
    const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
    const validApiKey = process.env.INGEST_API_KEY && apiKey === process.env.INGEST_API_KEY;

    if (!validApiKey && (!session?.user || (session.user as { role?: string }).role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 401 });
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
      { error: 'Failed to fetch organizations' },
      { status: 500 },
    );
  }
}
