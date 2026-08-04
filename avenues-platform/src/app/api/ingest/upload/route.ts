import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Papa from "papaparse";
import prisma from "@/lib/prisma";
import { resolveApiKeyOrg, hashPatientPii } from "@/lib/security";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

/**
 * POST /api/ingest/upload
 *
 * Direct Multipart/Form-Data & Raw File Upload Endpoint for CSV reports.
 * Supports web browser file uploads or external watcher pipelines.
 */
export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get("x-api-key");
    const headerOrgId = request.headers.get("x-org-id");

    // Resolve Org (API Key or Session fallback)
    let orgId = await resolveApiKeyOrg(apiKey, headerOrgId);

    if (!orgId) {
      // Check default fallback Org from DB if active single tenant
      const defaultOrg = await prisma.organization.findFirst({ select: { id: true } });
      if (defaultOrg) {
        orgId = defaultOrg.id;
      } else {
        return NextResponse.json({ error: "Unauthorized. Valid API Key required." }, { status: 401 });
      }
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as string) || "Generic";
    const yearStr = (formData.get("year") as string) || String(new Date().getFullYear());
    const year = parseInt(yearStr, 10);

    if (!file) {
      return NextResponse.json({ error: "No file provided in form payload." }, { status: 400 });
    }

    const fileName = file.name;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

    // Parse CSV Text defensively
    const text = buffer.toString("utf-8");
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = parsed.data as Record<string, unknown>[];

    // Security & Data Engineering Undercurrent: Hash any PII in rows
    const sanitizedRows = rows.map((row) => {
      const copy = { ...row };
      for (const k of Object.keys(copy)) {
        const lowerK = k.toLowerCase();
        if (lowerK.includes("patient") || lowerK.includes("name") || lowerK.includes("med aid no")) {
          const valStr = String(copy[k] ?? "");
          if (valStr && !valStr.startsWith("hash_")) {
            copy[`${k}_hash`] = hashPatientPii(valStr);
          }
        }
      }
      return copy;
    });

    // Record Ingestion Entry in Prisma YearDataRecord
    const existing = await prisma.yearDataRecord.findUnique({
      where: { year_orgId: { year, orgId } },
    });

    const uploadEntry = {
      fileName,
      sha256,
      category,
      uploadedAt: new Date().toISOString(),
      rowCount: sanitizedRows.length,
    };

    const locationData = (existing?.location as Record<string, unknown>) || {};
    const rawRows = (locationData.rawRows as Record<string, unknown>[]) || [];
    const updatedRows = [...rawRows, ...sanitizedRows];

    const updatedUploads = Array.isArray(existing?.uploads)
      ? [...(existing.uploads as unknown[]), uploadEntry]
      : [uploadEntry];

    const updatedLocationObj = {
      ...locationData,
      rawRows: updatedRows,
    };

    await prisma.yearDataRecord.upsert({
      where: { year_orgId: { year, orgId } },
      create: {
        orgId,
        year,
        location: updatedLocationObj as unknown as Prisma.InputJsonValue,
        uploads: updatedUploads as unknown as Prisma.InputJsonValue,
        processedHashes: [sha256],
      },
      update: {
        location: updatedLocationObj as unknown as Prisma.InputJsonValue,
        uploads: updatedUploads as unknown as Prisma.InputJsonValue,
        processedHashes: { push: sha256 },
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: `File '${fileName}' ingested successfully into Year ${year}`,
      fileInfo: {
        fileName,
        category,
        year,
        sha256,
        recordsProcessed: sanitizedRows.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[Upload API Error]:", error);
    return NextResponse.json(
      { error: "File upload ingestion failed", details: String(error) },
      { status: 500 }
    );
  }
}
