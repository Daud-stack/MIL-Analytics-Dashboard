import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { mergeDashboard, mergeLocation, mergeClaims, mergeGenericDatasets } from '@/lib/data-merger';
import type { DashboardMetrics, LocationData, ClaimsMetrics, GenericDataset } from '@/types';

/**
 * POST /api/data/ingest
 *
 * Machine-to-machine API for the file watcher to ingest parsed CSV data.
 * Requires X-API-Key header for authentication.
 *
 * Request headers:
 *   X-API-Key  — validates against process.env.INGEST_API_KEY
 *   X-Org-Id   — organization ID for the data
 *
 * Request body:
 *   {
 *     year: number,
 *     fileType: 'Dashboard' | 'Location' | 'Claims' | 'Generic',
 *     data: object,           // parsed result payload
 *     fileName: string,
 *     sha256: string          // file hash for deduplication
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     year: number,
 *     fileType: string,
 *     fileName: string,
 *     message: string,
 *     duplicate?: boolean
 *   }
 */
export async function POST(request: NextRequest) {
  try {
    // ── Validate API Key ──
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== process.env.INGEST_API_KEY) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    // ── Validate Org ID ──
    const orgId = request.headers.get('X-Org-Id');
    if (!orgId) {
      return NextResponse.json({ error: 'X-Org-Id header required' }, { status: 400 });
    }

    // ── Verify organization exists ──
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // ── Parse and validate request body ──
    const IngestSchema = z.object({
      year: z.number().int().min(2000).max(2100),
      fileType: z.enum(['Dashboard', 'Location', 'Claims', 'Generic']),
      data: z.record(z.string(), z.unknown()).refine(val => Object.keys(val).length > 0, {
        message: 'data must be a non-empty object',
      }),
      fileName: z.string().min(1).max(500),
      sha256: z.string().regex(/^[a-f0-9]{64}$/i, 'Must be a valid SHA-256 hash'),
    });

    const body = await request.json();
    const parsed = IngestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.issues.map(i => i.message) },
        { status: 400 }
      );
    }

    const { year, fileType, data, fileName, sha256 } = parsed.data;

    // ── Check for duplicate (same SHA-256) ──
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

    const existingDashboard = existing?.dashboard as unknown as DashboardMetrics | null | undefined;
    const existingLocation = existing?.location as unknown as LocationData | null | undefined;
    const existingClaims = existing?.claims as unknown as ClaimsMetrics | null | undefined;
    const existingDatasets = existing?.datasets as unknown as Record<string, GenericDataset> | null | undefined;

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

    // ── Build the update payload using merging ──
    const updateData: Record<string, unknown> = {};
    if (fileType === 'Dashboard') {
      updateData.dashboard = mergeDashboard(existingDashboard ?? null, data as unknown as DashboardMetrics);
    } else if (fileType === 'Location') {
      updateData.location = mergeLocation(existingLocation ?? null, data as unknown as LocationData);
    } else if (fileType === 'Claims') {
      updateData.claims = mergeClaims(existingClaims ?? null, data as unknown as ClaimsMetrics);
    } else if (fileType === 'Generic') {
      updateData.datasets = mergeGenericDatasets(existingDatasets, data as unknown as Record<string, GenericDataset>);
    }

    // ── Build upload metadata ──
    const uploadRecord = {
      id: sha256.substring(0, 12),
      fileName,
      category: fileType,
      uploadedAt: new Date().toISOString(),
      year,
      sha256,
      source: 'file-watcher',
    };

    // ── Merge with existing data ──
    const currentHashes = existing?.processedHashes || [];
    const currentUploads = ((existing?.uploads as Prisma.JsonArray | null | undefined) ?? []) as Prisma.JsonArray;
    const nextUploads = [...currentUploads, uploadRecord as Prisma.JsonObject] as Prisma.JsonArray;

    // ── Upsert YearDataRecord ──
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
    
    // ── Create Audit Log ──
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
            resourceId: result.id
          },
          orgId,
          // Note: Machine-to-machine auth has no userId
        }
      });
    } catch (auditError) {
      console.warn('[/api/data/ingest] Failed to create audit log:', auditError);
      // Don't fail the request if just the audit log fails
    }

    console.log(`[/api/data/ingest] Ingested ${fileType} data for year ${year} from ${fileName}`);

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
