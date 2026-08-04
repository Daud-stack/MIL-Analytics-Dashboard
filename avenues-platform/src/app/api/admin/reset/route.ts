import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { isAdminSession } from '@/lib/security';

/**
 * POST /api/admin/reset
 * Clears year_data and data_uploads for the admin's own organization.
 * Restricted to authenticated ADMIN users, scoped to their org.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
    }

    // Scope the reset to the admin's own organization — never cross-tenant.
    const user = await prisma.user.findUnique({
      where: { id: session!.user!.id },
      select: { orgId: true },
    });

    if (!user?.orgId) {
      return NextResponse.json({ error: 'No organization assigned' }, { status: 403 });
    }

    const uploadsDeleted = await prisma.dataUpload.deleteMany({ where: { orgId: user.orgId } });
    const yearDataDeleted = await prisma.yearDataRecord.deleteMany({ where: { orgId: user.orgId } });

    return NextResponse.json({
      success: true,
      deleted: {
        dataUploads: uploadsDeleted.count,
        yearDataRecords: yearDataDeleted.count,
      },
      message: 'Year data and upload records cleared for your organization. Users and organizations preserved.',
    });
  } catch (error) {
    console.error('[Admin Reset] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    );
  }
}
