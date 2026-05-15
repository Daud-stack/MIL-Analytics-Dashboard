import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { isAdminSession } from '@/lib/security';

/**
 * POST /api/admin/reset
 * Clears all year_data and data_uploads from the database.
 * Restricted to authenticated ADMIN users.
 */
export async function POST(_request: NextRequest) {
  try {
    const session = await auth();
    if (!isAdminSession(session)) {
      return NextResponse.json({ error: 'Unauthorized - admin access required' }, { status: 401 });
    }

    const uploadsDeleted = await prisma.dataUpload.deleteMany({});
    const yearDataDeleted = await prisma.yearDataRecord.deleteMany({});

    return NextResponse.json({
      success: true,
      deleted: {
        dataUploads: uploadsDeleted.count,
        yearDataRecords: yearDataDeleted.count,
      },
      message: 'All year data and upload records cleared. Users and organizations preserved.',
    });
  } catch (error) {
    console.error('[Admin Reset] Error:', error);
    return NextResponse.json(
      { error: 'Failed to reset database' },
      { status: 500 }
    );
  }
}
