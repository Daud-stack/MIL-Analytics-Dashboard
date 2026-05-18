import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import type { GenericDataset } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const IngestSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  fileType: z.enum(['Dashboard', 'Location', 'Claims', 'Generic']),
  data: z.record(z.string(), z.unknown()).refine(
    (value) => Object.keys(value).length > 0,
    { message: 'data must be a non-empty object' }
  ),
  fileName: z.string().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Must be a valid SHA-256 hash'),
});

/**
 * POST /api/data/ingest
 *
 * Machine-to-machine API for the file watcher to ingest parsed CSV data.
 * Requires X-API-Key and X-Org-Id headers.
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey || apiKey !== process.env.INGEST_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const orgId = request.headers.get('x-org-id');
    if (!orgId) {
      return NextResponse.json(
        { error: 'X-Org-Id header required' },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const parsed = IngestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.issues.map((issue) => issue.message),
        },
        { status: 400 }
      );
    }

    const { year, fileType, data, fileName, sha256 } = parsed.data;

    const existing = await prisma.yearDataRecord.findUnique({
      where: { year_orgId: { year, orgId } },
      select: {
        processedHashes: true,
        uploads: true,
        dashboard: true,
        location: true,
        claims: true,
        datasets: true,
      },
    });

    if (existing?.processedHashes?.includes(sha256)) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        year,
        fileType,
        fileName,
        message: `File ${fileName} already processed (hash match)`,
      });
    }

    const existingDatasets = existing?.datasets as
      | Record<string, GenericDataset>
      | null
      | undefined;

    const updateData: Record<string, unknown> = {};
    if (fileType === 'Dashboard') {
      updateData.dashboard = data;
    } else if (fileType === 'Location') {
      updateData.location = data;
    } else if (fileType === 'Claims') {
      updateData.claims = data;
    } else {
      updateData.datasets = replaceGenericDatasets(
        existingDatasets,
        data as unknown as Record<string, GenericDataset>
      );
    }

    const uploadRecord = {
      id: sha256.substring(0, 12),
      fileName,
      category: fileType,
      uploadedAt: new Date().toISOString(),
      year,
      sha256,
      source: 'file-watcher',
    };

    const currentHashes = existing?.processedHashes ?? [];
    const currentUploads = ((existing?.uploads as
      | Prisma.JsonArray
      | null
      | undefined) ?? []) as Prisma.JsonArray;
    const nextUploads = [
      ...currentUploads,
      uploadRecord as Prisma.JsonObject,
    ] as Prisma.JsonArray;

    const result = await prisma.yearDataRecord.upsert({
      where: { year_orgId: { year, orgId } },
      create: {
        year,
        orgId,
        ...updateData,
        processedHashes: [...currentHashes, sha256],
        uploads: nextUploads,
      },
      update: {
        ...updateData,
        processedHashes: [...currentHashes, sha256],
        uploads: nextUploads,
        updatedAt: new Date(),
      },
    });

    try {
      await prisma.auditLog.create({
        data: {
          action: 'UPLOAD',
          category: fileType,
          details: `Headless ingestion of ${fileName} (Year: ${year}) via file-watcher`,
          metadata: {
            fileName,
            year,
            sha256,
            resourceId: result.id,
          },
          orgId,
        },
      });
    } catch (auditError) {
      console.warn('[/api/data/ingest] Failed to create audit log:', auditError);
    }

    console.log(
      `[/api/data/ingest] Ingested ${fileType} data for year ${year} from ${fileName}`
    );

    return NextResponse.json({
      success: true,
      year: result.year,
      fileType,
      fileName,
      message: `Ingested ${fileType} data for year ${year}`,
    });
  } catch (error) {
    console.error('[API /data/ingest] Error:', error);
    console.error(error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Ingest failed' }, { status: 500 });
  }
}

function replaceGenericDatasets(
  existing: Record<string, GenericDataset> | null | undefined,
  incoming: Record<string, GenericDataset>
): Record<string, GenericDataset> {
  const next: Record<string, GenericDataset> = { ...(existing ?? {}) };
  const incomingSchemaIds = new Set(
    Object.values(incoming).map((dataset) => dataset.schemaId)
  );

  for (const [id, dataset] of Object.entries(next)) {
    if (incomingSchemaIds.has(dataset.schemaId)) {
      delete next[id];
    }
  }

  return { ...next, ...incoming };
}
