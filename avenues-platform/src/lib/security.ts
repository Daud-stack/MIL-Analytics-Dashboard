import crypto from "crypto";
import prisma from "@/lib/prisma";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

/** Anonymize patient names or member numbers using SHA-256 (Data Engineering Security Undercurrent) */
export function hashPatientPii(value: string): string {
  if (!value || value.trim() === "") return "ANONYMOUS";
  return sha256Hex(value.trim().toLowerCase()).slice(0, 16);
}


/** Generate a new raw API key (shown to the admin once). */
export function generateApiKey(): string {
  return `ak_${crypto.randomBytes(24).toString("base64url")}`;
}

/**
 * Resolve an API key to the organization it is bound to.
 *
 * Order of resolution:
 *  1. Per-org hashed keys in the api_keys table (preferred).
 *  2. Legacy shared INGEST_API_KEY env secret — bound to INGEST_ORG_ID when
 *     set, otherwise to the caller-supplied fallbackOrgId (legacy behaviour,
 *     kept only so existing watcher deployments don't break mid-migration).
 *
 * Returns the orgId, or null if the key is invalid/revoked.
 */
export async function resolveApiKeyOrg(
  rawKey: string | null | undefined,
  fallbackOrgId?: string | null
): Promise<string | null> {
  if (!rawKey) return null;

  try {
    const record = await prisma.apiKey.findUnique({
      where: { keyHash: sha256Hex(rawKey) },
      select: { id: true, orgId: true, revokedAt: true },
    });
    if (record) {
      if (record.revokedAt) return null;
      // Best-effort usage stamp; never block the request on it
      prisma.apiKey
        .update({ where: { id: record.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
      return record.orgId;
    }
  } catch (err) {
    console.error("[Security] ApiKey lookup failed:", err);
    // fall through to legacy env key so an outage doesn't kill ingestion
  }

  // Legacy shared secret
  if (isValidIngestApiKey(rawKey)) {
    return process.env.INGEST_ORG_ID || fallbackOrgId || null;
  }

  return null;
}

/**
 * Durable fixed-window rate limiter backed by the rate_limits table, so it
 * works across serverless instances. Falls back to the in-memory limiter if
 * the database is unreachable (fail-open on infrastructure errors, closed on
 * genuine limit hits).
 */
export async function enforceDbRateLimit(
  key: string,
  options: { maxRequests: number; windowMs: number }
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const now = new Date();
  try {
    // Atomic upsert-and-increment: reset the window if expired, else bump.
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "rate_limits" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${new Date(now.getTime() + options.windowMs)})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN "rate_limits"."resetAt" <= ${now} THEN 1 ELSE "rate_limits"."count" + 1 END,
        "resetAt" = CASE WHEN "rate_limits"."resetAt" <= ${now} THEN ${new Date(now.getTime() + options.windowMs)} ELSE "rate_limits"."resetAt" END
      RETURNING "count", "resetAt"
    `;
    const row = rows[0];
    if (row && row.count > options.maxRequests) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((row.resetAt.getTime() - now.getTime()) / 1000)),
      };
    }
    return { allowed: true };
  } catch (err) {
    console.error("[Security] DB rate limit failed, using in-memory fallback:", err);
    return enforceRateLimit(key, options);
  }
}

export function timingSafeEqualString(
  provided: string | null | undefined,
  expected: string | null | undefined
): boolean {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
}

export function isValidIngestApiKey(apiKey: string | null | undefined): boolean {
  return timingSafeEqualString(apiKey, process.env.INGEST_API_KEY);
}

export function isAdminSession(
  session: { user?: { role?: string } } | null | undefined
): boolean {
  return session?.user?.role === "ADMIN";
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

export function enforceRateLimit(
  key: string,
  options: { maxRequests: number; windowMs: number }
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  const now = Date.now();
  const existing = rateLimitStore.get(key);

  if (!existing || existing.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });
    return { allowed: true };
  }

  if (existing.count >= options.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  rateLimitStore.set(key, existing);
  return { allowed: true };
}
