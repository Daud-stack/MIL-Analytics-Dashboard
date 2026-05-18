import { test, expect } from '@playwright/test';
import { collectRuntimeErrors, expectNoErrorBoundary, login } from './helpers';

test.describe('Sidebar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('sidebar exposes the primary navigation links', async ({ page }) => {
    await page.goto('/dashboard');
    const sidebar = page.locator('nav, aside').first();
    await expect(sidebar).toBeVisible();

    // Each of these labels exists in src/store/sidebar.ts. They may be inside
    // collapsed sections, so we count occurrences in the DOM rather than
    // requiring them to be visible.
    const expected = ['Dashboard', 'Drill-Down', 'Upload', 'Revenue', 'Settings'];
    for (const label of expected) {
      const matches = sidebar.getByText(new RegExp(`^${label}$`, 'i'));
      expect(
        await matches.count(),
        `expected sidebar to mention "${label}"`
      ).toBeGreaterThan(0);
    }
  });

  test('clicking a sidebar link changes the route', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const link = page
      .locator('nav, aside')
      .first()
      .getByRole('link', { name: /^revenue$/i })
      .first();
    await link.click();

    await page.waitForURL(/\/revenue/, { timeout: 15_000 });
    await expectNoErrorBoundary(page);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('active link receives active styling', async ({ page }) => {
    await page.goto('/revenue');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    // Sidebar uses teal-tinted classes on the active link.
    const active = page
      .locator('nav, aside')
      .first()
      .locator('a[class*="text-teal"], a[class*="bg-teal"]');
    expect(await active.count()).toBeGreaterThan(0);
  });
});
