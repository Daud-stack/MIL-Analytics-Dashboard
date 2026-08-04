import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/auth';
import prisma from '@/lib/prisma';
import { isAdminSession, generateApiKey, sha256Hex } from '@/lib/security';

/**
 * Admin management of per-org machine API keys (file watcher, integrations).
 *
 * GET    /api/admin/apikeys        — list keys for the admin's org (no secrets)
 * POST   /api/admin/apikeys        — create a key; the raw key is returned ONCE
 * DELETE /api/admin/apikeys?id=... — revoke a key
 *
 * All operations are scoped to the admin's own organization.
 */

async function requireAdminOrg() {
  const session = await auth();
  if (!isAdminSession(session)) {
    return { error: NextResponse.json({ error: 'Admin access required' }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({
    where: { id: session!.user!.id },
    select: { orgId: true, id: true },
  });
  if (!user?.orgId) {
    return { error: NextResponse.json({ error: 'No organization assigned' }, { status: 403 }) };
  }
  return { orgId: user.orgId, userId: user.id };
}

export async function GET() {
  try {
    const ctx = await requireAdminOrg();
    if ('error' in ctx) return ctx.error;

    const keys = await prisma.apiKey.findMany({
      where: { orgId: ctx.orgId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
    });
    return NextResponse.json({ keys });
  } catch (error) {
    console.error('[Admin ApiKeys] GET error:', error);
    return NextResponse.json({ error: 'Failed to list API keys' }, { status: 500 });
  }
}

const CreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAdminOrg();
    if ('error' in ctx) return ctx.error;

    const parsed = CreateSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'A key name is required' }, { status: 400 });
    }

    const rawKey = generateApiKey();
    const record = await prisma.apiKey.create({
      data: {
        name: parsed.data.name,
        keyHash: sha256Hex(rawKey),
        orgId: ctx.orgId,
        createdBy: ctx.userId,
      },
      select: { id: true, name: true, createdAt: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'SETTINGS_CHANGE',
        category: 'System',
        details: `API key "${record.name}" created`,
        userId: ctx.userId,
        orgId: ctx.orgId,
      },
    });

    return NextResponse.json({
      success: true,
      key: record,
      // Shown exactly once — only the hash is stored.
      rawKey,
      message: 'Store this key now; it cannot be retrieved again.',
    }, { status: 201 });
  } catch (error) {
    console.error('[Admin ApiKeys] POST error:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const ctx = await requireAdminOrg();
    if ('error' in ctx) return ctx.error;

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id parameter required' }, { status: 400 });
    }

    // updateMany with org scope: cannot revoke another org's key
    const result = await prisma.apiKey.updateMany({
      where: { id, orgId: ctx.orgId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: 'Key not found or already revoked' }, { status: 404 });
    }

    await prisma.auditLog.create({
      data: {
        action: 'SETTINGS_CHANGE',
        category: 'System',
        details: `API key ${id} revoked`,
        userId: ctx.userId,
        orgId: ctx.orgId,
      },
    });

    return NextResponse.json({ success: true, revoked: id });
  } catch (error) {
    console.error('[Admin ApiKeys] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to revoke API key' }, { status: 500 });
  }
}
