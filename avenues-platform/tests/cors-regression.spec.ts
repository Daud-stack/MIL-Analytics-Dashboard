import { test, expect } from '@playwright/test';

/**
 * Regression test for the cross-origin redirect bug.
 *
 * Symptom: visiting /login (or any page that prefetches /forgot-password via
 * <Link>) caused an RSC fetch to /forgot-password?_rsc=... that the local
 * server redirected to https://mil-analytics-dashboard.vercel.app/login,
 * triggering a CORS-blocked preflight failure.
 *
 * Root cause: `NEXTAUTH_URL` was set in .env / .env.production. NextAuth v5
 * applies that value via `reqWithEnvURL()` and rewrites every request's
 * origin, so `new URL("/login", req.nextUrl)` in src/proxy.ts produced a
 * cross-origin URL.
 *
 * Fix: remove NEXTAUTH_URL/AUTH_URL (AUTH_TRUST_HOST=true is enough) and
 * harden src/proxy.ts to reconstruct the origin from request headers.
 *
 * This test fails if either regression is reintroduced.
 */
test('no cross-origin redirects are issued for any request from /login', async ({ page }) => {
  const offending: { url: string; location: string | null }[] = [];

  page.on('response', (response) => {
    const status = response.status();
    if (status < 300 || status >= 400) return;
    const location = response.headers()['location'] ?? null;
    if (!location) return;

    const reqUrl = new URL(response.url());
    // Resolve Location relative to the request URL (it may be relative).
    let target: URL;
    try {
      target = new URL(location, reqUrl);
    } catch {
      return;
    }

    if (target.origin !== reqUrl.origin) {
      offending.push({ url: response.url(), location });
    }
  });

  await page.goto('/login');
  // Give Next.js a moment to fire any RSC prefetches from <Link>.
  await page.waitForLoadState('networkidle').catch(() => undefined);

  expect(
    offending,
    `expected zero cross-origin redirects, got:\n${offending
      .map((r) => `  ${r.url} -> ${r.location}`)
      .join('\n')}`
  ).toEqual([]);
});

test('middleware redirect for protected page stays on the request origin', async ({ page }) => {
  const responses: { url: string; status: number; location: string | null }[] = [];
  page.on('response', (r) => {
    responses.push({
      url: r.url(),
      status: r.status(),
      location: r.headers()['location'] ?? null,
    });
  });

  // Navigate directly to a protected route while unauthenticated. The
  // middleware should redirect us to /login on the SAME origin.
  await page.goto('/dashboard');

  // The browser followed the redirect; check final URL is /login on same origin.
  const final = new URL(page.url());
  expect(final.pathname).toMatch(/^\/login/);

  // Also assert no intermediate 3xx Location header pointed off-origin.
  const baseOrigin = new URL(page.url()).origin;
  const offOrigin = responses.filter((r) => {
    if (r.status < 300 || r.status >= 400 || !r.location) return false;
    try {
      const t = new URL(r.location, r.url);
      return t.origin !== baseOrigin;
    } catch {
      return false;
    }
  });

  expect(offOrigin, JSON.stringify(offOrigin, null, 2)).toEqual([]);
});
