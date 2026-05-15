import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/**
 * GET /api/audit?limit=50&action=UPLOAD
 * Returns recent audit log entries for the user's organization.
 */
export async function GET(request: NextRequest) {
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

    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const action = searchParams.get('action');

    const where: Record<string, unknown> = { orgId: user.orgId };
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit — Create an audit log entry (internal use)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const body = await request.json();

    const log = await prisma.auditLog.create({
      data: {
        action: body.action || 'UNKNOWN',
        category: body.category,
        details: body.details,
        metadata: body.metadata,
        userId: session?.user?.id || body.userId,
        userName: session?.user?.name || session?.user?.email || body.userName || 'System',
        orgId: body.orgId,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
      },
    });

    return NextResponse.json({ success: true, id: log.id });
  } catch (error) {
    console.error('[Audit API] Write error:', error);
    return NextResponse.json(
      { error: 'Failed to create audit log' },
      { status: 500 }
    );
  }
}
