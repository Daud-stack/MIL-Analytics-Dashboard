import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * POST /api/admin/reset
 * Clears all year_data and data_uploads from the database.
 * Protected by INGEST_API_KEY (same key used for machine-to-machine ingest).
 *
 * Usage: curl -X POST https://mil-analytics-dashboard.vercel.app/api/admin/reset \
 *          -H "x-api-key: YOUR_INGEST_API_KEY"
 */
export async function POST(request: NextRequest) {
  try {
    // Auth: require INGEST_API_KEY
    const apiKey = request.headers.get('x-api-key');
    const expectedKey = process.env.INGEST_API_KEY;

    if (!expectedKey || apiKey !== expectedKey) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      { error: 'Failed to reset database', details: String(error) },
      { status: 500 }
    );
  }
}
