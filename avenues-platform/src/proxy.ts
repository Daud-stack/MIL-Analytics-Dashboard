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

  if (host) {
    return new URL(path, `${proto}://${host}`);
  }
  return new URL(path, req.nextUrl);
}

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isApiRoute = req.nextUrl.pathname.startsWith("/api/");
  const isAuthPage =
    req.nextUrl.pathname.startsWith("/login") ||
    req.nextUrl.pathname.startsWith("/register");

  if (isApiRoute) {
    return NextResponse.next();
  }

  if (isAuthPage && isLoggedIn) {
    return NextResponse.redirect(sameOriginUrl("/dashboard", req));
  }

  if (!isAuthPage && !isLoggedIn) {
    const callbackUrl = encodeURIComponent(
      req.nextUrl.pathname + req.nextUrl.search
    );
    return NextResponse.redirect(
      sameOriginUrl(`/login?callbackUrl=${callbackUrl}`, req)
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
