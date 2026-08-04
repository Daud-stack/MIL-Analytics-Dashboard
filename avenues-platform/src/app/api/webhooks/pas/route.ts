import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { timingSafeEqualString } from '@/lib/security';
import { z } from 'zod';

/**
 * POST /api/webhooks/pas
 * 
 * Secure webhook endpoint for automated EMR/PAS (Patient Administration System)
 * data ingestion. External hospital systems can POST clinical or financial data
 * here to automatically update the Neon Postgres database without manual CSV uploads.
 * 
 * Authentication: Bearer token via `WEBHOOK_SECRET` environment variable.
 * 
 * Example usage:
 *   curl -X POST https://your-app.vercel.app/api/webhooks/pas \
 *     -H "Authorization: Bearer YOUR_WEBHOOK_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{
 *       "orgSlug": "avenues-clinic",
 *       "year": 2026,
 *       "category": "Dashboard",
 *       "data": { "totalRevenue": 15000000, "monthRevenue": [1200000, ...] }
 *     }'
 */

// ─── Validation Schema ───────────────────────────────────────

const WebhookPayloadSchema = z.object({
  orgSlug: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100),
  category: z.enum(['Dashboard', 'Location', 'Claims']),
  data: z.record(z.string(), z.unknown()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'data must be a non-empty object' }
  ),
  source: z.string().optional().default('external-webhook'),
});

// ─── Bearer Token Auth ───────────────────────────────────────

function authenticateWebhook(request: NextRequest): boolean {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    console.error('[Webhook] WEBHOOK_SECRET not configured in environment variables');
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.slice(7);
  // Constant-time comparison to prevent timing attacks
  return timingSafeEqualString(token, secret);
}

// ─── Route Handler ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    if (!authenticateWebhook(request)) {
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Invalid or missing Bearer token' },
        { status: 401 }
      );
    }

    // 2. Parse & validate body
    const body = await request.json();
    const result = WebhookPayloadSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Validation Error',
          issues: result.error.issues.map((i) => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 }
      );
    }

    const { orgSlug, year, category, data, source } = result.data;

    // 2b. If WEBHOOK_ORG_SLUG is configured, this secret is bound to that org -
    // the payload cannot target another tenant.
    const pinnedSlug = process.env.WEBHOOK_ORG_SLUG;
    if (pinnedSlug && orgSlug !== pinnedSlug) {
      return NextResponse.json(
        { error: 'Forbidden', message: 'orgSlug does not match the org this webhook secret is bound to' },
        { status: 403 }
      );
    }

    // 3. Look up the organization
    const org = await prisma.organization.findUnique({
      where: { slug: orgSlug },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: 'Not Found', message: `Organization with slug "${orgSlug}" does not exist` },
        { status: 404 }
      );
    }

    // 4. Build the update object based on category
    const categoryFieldMap: Record<string, string> = {
      Dashboard: 'dashboard',
      Location: 'location',
      Claims: 'claims',
    };
    const field = categoryFieldMap[category];

    const updateData: Record<string, unknown> = {};
    updateData[field] = data;

    // 5. Upsert into the database
    const record = await prisma.yearDataRecord.upsert({
      where: {
        year_orgId: { year, orgId: org.id },
      },
      create: {
        year,
        orgId: org.id,
        [field]: data,
      },
      update: updateData,
    });

    await prisma.auditLog.create({
      data: {
        action: 'WEBHOOK',
        category: category,
        details: `Ingested ${category} data for year ${year} via ${source}`,
        orgId: org.id,
        userName: `System (${source})`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        metadata: { year, source, category }
      }
    });

    console.log(
      `[Webhook] ✅ ${category} data ingested for ${org.name} (${year}) via ${source} | record=${record.id}`
    );

    return NextResponse.json(
      {
        success: true,
        message: `${category} data for ${year} successfully ingested`,
        recordId: record.id,
        organization: org.name,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[Webhook] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check for the webhook endpoint
export async function GET() {
  const hasSecret = !!process.env.WEBHOOK_SECRET;
  return NextResponse.json({
    status: 'ok',
    endpoint: '/api/webhooks/pas',
    authenticated: hasSecret,
    timestamp: new Date().toISOString(),
    usage: {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer <WEBHOOK_SECRET>',
        'Content-Type': 'application/json',
      },
      body: {
        orgSlug: 'string (required)',
        year: 'number (required, 2000-2100)',
        category: 'Dashboard | Location | Claims',
        data: 'object (required, non-empty)',
        source: 'string (optional, defaults to "external-webhook")',
      },
    },
  });
}
