/**
 * /api/ingest — Serves ingested data to the browser
 *
 * GET /api/ingest
 *   Returns the full ingest store (years + log)
 *   Query params:
 *     ?since=<ISO timestamp> — only return data updated after this time
 *     ?year=<number>         — return only a specific year
 *
 * GET /api/ingest?action=log
 *   Returns only the processing log (for the upload history page)
 *
 * DELETE /api/ingest
 *   Clears the ingest store (for testing/reset)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  readIngestStore,
  writeIngestStore,
  getStorePath,
} from '@/lib/ingest-store';
import fs from 'fs';

export async function GET(request: NextRequest) {
  try {
    const storePath = getStorePath();

    // Check if store file exists
    if (!fs.existsSync(storePath)) {
      return NextResponse.json({
        years: {},
        log: [],
        updatedAt: null,
        hasData: false,
      });
    }

    const store = readIngestStore();
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const since = searchParams.get('since');
    const yearParam = searchParams.get('year');

    // Return only the log
    if (action === 'log') {
      return NextResponse.json({
        log: store.log,
        totalFiles: store.log.length,
        uniqueHashes: store.processedHashes.length,
      });
    }

    // Filter by "since" timestamp (client sends its last sync time)
    if (since) {
      const sinceDate = new Date(since);
      const storeDate = new Date(store.updatedAt);
      if (storeDate <= sinceDate) {
        // No new data since client's last sync
        return NextResponse.json({
          hasNewData: false,
          updatedAt: store.updatedAt,
        });
      }
    }

    // Filter by year
    if (yearParam) {
      const yearData = store.years[yearParam];
      return NextResponse.json({
        years: yearData ? { [yearParam]: yearData } : {},
        log: store.log.filter(e => String(e.year) === yearParam),
        updatedAt: store.updatedAt,
        hasData: !!yearData,
      });
    }

    // Return full store
    return NextResponse.json({
      years: store.years,
      log: store.log,
      updatedAt: store.updatedAt,
      hasData: Object.keys(store.years).length > 0,
      processedFiles: store.processedHashes.length,
    });
  } catch (error) {
    console.error('[API /ingest] Error:', error);
    return NextResponse.json(
      { error: 'Failed to read ingest store' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const emptyStore = {
      years: {},
      processedHashes: [] as string[],
      log: [] as { fileName: string; sha256: string; fileType: string; year: number; processedAt: string; rowCount?: number }[],
      updatedAt: new Date().toISOString(),
    };
    writeIngestStore(emptyStore);
    return NextResponse.json({ success: true, message: 'Ingest store cleared' });
  } catch (error) {
    console.error('[API /ingest] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to clear ingest store' },
      { status: 500 }
    );
  }
}
