import crypto from "crypto";

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

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
