import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/reset
 * Clears all year_data and data_uploads from the database.
 * Protected by session auth (ADMIN role) OR INGEST_API_KEY (M2M).
 *
 * Usage: curl -X POST https://mil-analytics-dashboard.vercel.app/api/admin/reset \
 *          -H "X-API-Key: YOUR_INGEST_API_KEY"
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: require ADMIN session OR valid API key
    const session = await auth();
    const apiKey = request.headers.get('x-api-key') || request.headers.get('X-API-Key');
    const expectedKey = process.env.INGEST_API_KEY;
    const validApiKey = expectedKey && apiKey === expectedKey;

    if (!validApiKey && (!session?.user || (session.user as { role?: string }).role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized — admin access required' }, { status: 401 });
    }

    // Delete data in correct order (respect foreign keys)
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
