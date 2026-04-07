import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware for route protection and auth redirects.
 *
 * In development, all routes are accessible without auth.
 * In production, protected routes require a valid session cookie.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check in development for easier iteration
  if (process.env.NODE_ENV === "development") {
    return NextResponse.next();
  }

  // Public routes that don't require authentication
  const publicRoutes = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/health",
  ];

  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // API routes for authentication don't need middleware protection
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Check for session cookie (NextAuth sets this)
  const sessionToken =
    request.cookies.get("__Secure-authjs.session-token") ??
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("next-auth.session-token");

  const isAuthenticated = !!sessionToken;

  // Public routes can be accessed by anyone
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // All other routes require authentication
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If authenticated and trying to access auth pages, redirect to dashboard
  if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
