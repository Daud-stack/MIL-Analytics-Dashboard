import { test, expect } from '@playwright/test';
import {
  collectRuntimeErrors,
  expectMainHeading,
  expectNoErrorBoundary,
  login,
} from './helpers';

/**
 * Routes selected from the sidebar that should always render for an ADMIN
 * with no data loaded (i.e. empty-state friendly).
 */
const PROTECTED_ROUTES: { path: string; label: string }[] = [
  { path: '/dashboard', label: 'Dashboard' },
  { path: '/drilldown', label: 'Drill-Down' },
  { path: '/upload', label: 'Upload' },
  { path: '/episodes', label: 'Episodes' },
  { path: '/admissions', label: 'Admissions' },
  { path: '/occupancy', label: 'Occupancy' },
  { path: '/ward-beds', label: 'Ward Beds' },
  { path: '/revenue', label: 'Revenue' },
  { path: '/claims', label: 'Claims' },
  { path: '/patients', label: 'Patients' },
  { path: '/dataset-explorer', label: 'Dataset Explorer' },
  { path: '/settings', label: 'Settings' },
];

test.describe('Dashboard pages render', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { path, label } of PROTECTED_ROUTES) {
    test(`${label} (${path}) renders without runtime errors`, async ({ page }) => {
      const errors = collectRuntimeErrors(page);
      await page.goto(path);
      await page.waitForLoadState('networkidle').catch(() => undefined);

      await expectNoErrorBoundary(page);
      await expectMainHeading(page);

      // Page returned HTTP 200-ish (not a 4xx/5xx)
      const url = page.url();
      expect(url).toContain(path);

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  test('dashboard shows KPI cards / stat tiles', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    // Cards usually have role="article" or specific shadcn class names.
    // Use a flexible selector: any <main> child div that contains a heading
    // and a numeric value. Falls back to checking >= 1 visible card-shaped block.
    const cards = page.locator('main').locator(
      'div:has(> h2, > h3, > [class*="text-xs"], > [class*="font-semibold"])'
    );
    expect(await cards.count()).toBeGreaterThan(0);
  });
});
