/**
 * /api/ingest - Serves freshly ingested year data to the browser.
 *
 * This reads from the Postgres `year_data` table: the same table written by
 * the CSV file watcher through POST /api/data/ingest. Keeping both paths on
 * one data store lets the dashboard poller see watcher uploads in deployed
 * environments where local JSON files are not durable.
 *
 * Query parameters:
 *   ?since=<ISO timestamp>   Return only data updated after this time.
 *   ?year=<number>           Return only this year.
 *   ?action=log              Return upload history from row upload metadata.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { resolveApiKeyOrg } from '@/lib/security';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type UploadEntry = {
  fileName?: string;
  sha256?: string;
  category?: string;
  fileType?: string;
  year?: number;
  uploadedAt?: string;
  processedAt?: string;
};

type YearDataWhere = {
  orgId: string;
  year?: number;
  updatedAt?: { gt: Date };
};

async function resolveOrgId(request: NextRequest): Promise<
  | { orgId: string }
  | { response: NextResponse }
> {
  const session = await auth();
  const apiKey = request.headers.get('x-api-key');

  if (apiKey) {
    // Per-org hashed keys (api_keys table); legacy env key honoured during
    // migration. The org comes from the key, not from the caller.
    const headerOrgId = request.headers.get('x-org-id');
    const orgId = await resolveApiKeyOrg(apiKey, headerOrgId);
    if (!orgId) {
      return {
        response: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }
    if (headerOrgId && headerOrgId !== orgId) {
      return {
        response: NextResponse.json(
          { error: 'X-Org-Id does not match the org this API key is bound to' },
          { status: 403 }
        ),
      };
    }
    return { orgId };
  }

  if (!session?.user) {
    return {
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { orgId: true },
  });

  if (!user?.orgId) {
    return {
      response: NextResponse.json(
        { error: 'No organization assigned' },
        { status: 403 }
      ),
    };
  }

  return { orgId: user.orgId };
}

export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveOrgId(request);
    if ('response' in resolved) return resolved.response;

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const since = searchParams.get('since');
    const yearParam = searchParams.get('year');

    const where: YearDataWhere = { orgId: resolved.orgId };

    if (yearParam) {
      const year = parseInt(yearParam, 10);
      if (Number.isFinite(year) && year >= 2000 && year <= 2100) {
        where.year = year;
      }
    }

    if (since) {
      const sinceDate = new Date(since);
      if (!Number.isNaN(sinceDate.getTime())) {
        where.updatedAt = { gt: sinceDate };
      }
    }

    // Fast path for normal polling. If no row changed after `since`, the
    // client can skip the merge work.
    if (since && !yearParam && action !== 'log') {
      const latest = await prisma.yearDataRecord.findFirst({
        where: { orgId: resolved.orgId },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });
      const sinceDate = new Date(since);

      if (
        !latest ||
        (!Number.isNaN(sinceDate.getTime()) && latest.updatedAt <= sinceDate)
      ) {
        return NextResponse.json({
          hasNewData: false,
          updatedAt: latest?.updatedAt?.toISOString() ?? null,
        });
      }
    }

    const records = await prisma.yearDataRecord.findMany({
      where,
      orderBy: { year: 'desc' },
    });

    if (action === 'log') {
      const log: UploadEntry[] = records.flatMap((record) => {
        const uploads = (record.uploads ?? []) as UploadEntry[];
        return uploads.map((upload) => ({ ...upload, year: record.year }));
      });

      log.sort((a, b) => {
        const timeA = Date.parse(a.uploadedAt ?? a.processedAt ?? '') || 0;
        const timeB = Date.parse(b.uploadedAt ?? b.processedAt ?? '') || 0;
        return timeB - timeA;
      });

      return NextResponse.json({
        log,
        totalFiles: log.length,
        uniqueHashes: new Set(
          records.flatMap((record) => record.processedHashes ?? [])
        ).size,
      });
    }

    const years: Record<string, unknown> = {};
    let maxUpdatedAt: Date | null = null;

    for (const record of records) {
      years[String(record.year)] = {
        year: record.year,
        dash: record.dashboard,
        dashboard: record.dashboard,
        loc: record.location,
        location: record.location,
        apac: record.claims,
        claims: record.claims,
        datasets: record.datasets ?? {},
        uploads: record.uploads ?? [],
        processedHashes: record.processedHashes ?? [],
      };

      if (!maxUpdatedAt || record.updatedAt > maxUpdatedAt) {
        maxUpdatedAt = record.updatedAt;
      }
    }

    return NextResponse.json({
      years,
      hasData: records.length > 0,
      hasNewData: records.length > 0,
      updatedAt: maxUpdatedAt?.toISOString() ?? null,
      processedFiles: records.reduce(
        (count, record) => count + (record.processedHashes?.length ?? 0),
        0
      ),
    });
  } catch (error) {
    console.error('[API /ingest GET] Error:', error);
    return NextResponse.json(
      { error: 'Failed to read ingested data' },
      { status: 500 }
    );
  }
}
