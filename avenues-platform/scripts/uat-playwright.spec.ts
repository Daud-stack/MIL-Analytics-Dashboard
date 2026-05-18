import { expect, test, type Page } from '@playwright/test';

const BASE_URL = process.env.UAT_BASE_URL ?? 'http://localhost:3100';
const ADMIN_EMAIL = process.env.UAT_EMAIL ?? 'admin@avenues.clinic';
const ADMIN_PASSWORD = process.env.UAT_PASSWORD ?? 'admin123';

const protectedRoutes = [
  '/dashboard',
  '/drilldown',
  '/ward-beds',
  '/upload',
  '/revenue',
  '/admissions',
  '/occupancy',
  '/claims',
  '/patients',
  '/doctors',
  '/dataset-explorer',
];

async function collectRuntimeErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  await page.locator('#email').fill(ADMIN_EMAIL);
  await page.locator('#password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
}

async function expectMainContent(page: Page) {
  const visibleHeading = page.locator('main h1:visible, main h2:visible, [role="main"] h1:visible, [role="main"] h2:visible').first();
  await expect(visibleHeading).toBeVisible();
}

test.describe('Avenues platform UAT smoke', () => {
  test('auth screens and protected redirect work', async ({ page }) => {
    const runtimeErrors = await collectRuntimeErrors(page);

    await page.goto(`${BASE_URL}/dashboard`);
    await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fdashboard/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    await page.goto(`${BASE_URL}/register`);
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();

    await page.goto(`${BASE_URL}/login`);
    await page.locator('#email').fill('invalid@example.com');
    await page.locator('#password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 15000 });

    expect(runtimeErrors).toEqual([]);
  });

  test('authenticated desktop module smoke', async ({ page }) => {
    const runtimeErrors = await collectRuntimeErrors(page);
    await page.setViewportSize({ width: 1440, height: 950 });
    await login(page);

    for (const route of protectedRoutes) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('body')).not.toContainText(/application error|internal server error|runtime error/i);
      await expectMainContent(page);
    }

    expect(runtimeErrors).toEqual([]);
  });

  test('mobile responsive smoke for drilldown and ward beds', async ({ page }) => {
    const runtimeErrors = await collectRuntimeErrors(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);

    for (const route of ['/drilldown', '/ward-beds']) {
      await page.goto(`${BASE_URL}${route}`);
      await page.waitForLoadState('networkidle');
      await expectMainContent(page);
      await expect(page.locator('body')).not.toContainText(/application error|internal server error|runtime error/i);

      const horizontalOverflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > window.innerWidth + 8;
      });
      expect(horizontalOverflow, `${route} should not force page-level horizontal scrolling`).toBe(false);
    }

    expect(runtimeErrors).toEqual([]);
  });
});
