import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { isAdminSession } from '@/lib/security';

/**
 * GET /api/admin/orgs
 *
 * Returns all organizations. Restricted to authenticated ADMIN users.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
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
