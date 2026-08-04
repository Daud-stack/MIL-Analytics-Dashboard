import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Build a same-origin redirect URL.
 *
 * NextAuth v5's reqWithEnvURL() rewrites req.nextUrl.origin to match
 * process.env.AUTH_URL ?? process.env.NEXTAUTH_URL when either is set. That
 * means new URL("/login", req.nextUrl) can produce a cross-origin URL like
 * https://mil-analytics-dashboard.vercel.app/login when the real request
 * was for http://localhost:3100, triggering a CORS-blocked redirect for
 * RSC fetches. We defend against that by reconstructing the origin from the
 * request's host / x-forwarded-* headers, which is what AUTH_TRUST_HOST=true
 * is already asking us to do for auth decisions.
 */
function sameOriginUrl(
  path: string,
  req: { headers: Headers; nextUrl: URL }
): URL {
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const nextUrlProto = req.nextUrl.protocol.replace(":", "");
  const proto = forwardedProto ?? nextUrlProto ?? "http";

  // Host headers are attacker-controllable on non-Vercel hosting; when
  // ALLOWED_HOSTS is configured (comma-separated), only redirect to hosts on
  // the list - otherwise fall back to the request URL's own origin.
  const allowedHosts = (process.env.ALLOWED_HOSTS || "")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);

  if (host && (allowedHosts.length === 0 || allowedHosts.includes(host.toLowerCase()))) {
    return new URL(path, `${proto}://${host}`);
  }
  return new URL(path, req.nextUrl);
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  // @ts-ignore - The user type includes role in our custom next-auth setup
  const userRole = (req.auth?.user as any)?.role || "VIEWER";

  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  // Machine-to-machine ingest endpoint: it authenticates itself via X-API-Key
  // (see /api/data/ingest), so session enforcement here would block the file
  // watcher. The route fails closed if the key is missing or wrong.
  const isMachineIngestRoute = req.nextUrl.pathname.startsWith("/api/data/ingest");
  const isApiDataRoute =
    !isMachineIngestRoute &&
    (req.nextUrl.pathname.startsWith("/api/data") || req.nextUrl.pathname.startsWith("/api/audit"));

  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");

  const isAdminAnalystRoute = 
    req.nextUrl.pathname.startsWith("/upload") || 
    req.nextUrl.pathname.startsWith("/settings");

  // Protect sensitive APIs
  if (isApiDataRoute && !isLoggedIn) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
  }

  // Allow other API routes (e.g., next-auth APIs) to pass through
  if (isApiRoute) {
    return NextResponse.next();
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(sameOriginUrl("/hospital", req));
  }

  if (!isAuthPage && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(
      sameOriginUrl(`/login?callbackUrl=${callbackUrl}`, req)
    );
  }

  // Enforce RBAC for Admin/Analyst routes
  if (isAdminAnalystRoute && isLoggedIn && !["ADMIN", "ANALYST"].includes(userRole as string)) {
    return NextResponse.redirect(sameOriginUrl("/hospital", req));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
