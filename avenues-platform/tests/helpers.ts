import { expect, type Page } from '@playwright/test';

export const TEST_EMAIL = process.env.TEST_EMAIL ?? 'admin@avenues.clinic';
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'admin123';

/**
 * Sign in via the credentials form and wait for redirect out of /login.
 */
export async function login(page: Page, email = TEST_EMAIL, password = TEST_PASSWORD) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 20_000 });
}

/**
 * Subscribe to console / page errors and return a mutable array of strings.
 * Filter out known noisy errors that aren't bugs.
 */
export function collectRuntimeErrors(page: Page): string[] {
  const errors: string[] = [];
  const ignore = [
    /favicon/i,
    /Failed to load resource.*(401|403)/i, // expected when probing protected resources
    /ResizeObserver loop/i, // Recharts/known benign
  ];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (ignore.some((re) => re.test(text))) return;
    errors.push(`[console] ${text}`);
  });
  page.on('pageerror', (err) => {
    if (ignore.some((re) => re.test(err.message))) return;
    errors.push(`[pageerror] ${err.message}`);
  });
  return errors;
}

/**
 * Assert that the page rendered a main content heading (h1/h2 inside <main>).
 * Useful as a generic "page didn't crash" check across many routes.
 */
export async function expectMainHeading(page: Page) {
  const heading = page
    .locator('main h1:visible, main h2:visible, [role="main"] h1:visible, [role="main"] h2:visible')
    .first();
  await expect(heading).toBeVisible({ timeout: 15_000 });
}

/**
 * Assert no visible error overlays.
 */
export async function expectNoErrorBoundary(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /application error|internal server error|runtime error|something went wrong/i
  );
}
