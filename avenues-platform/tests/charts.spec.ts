import { test, expect } from '@playwright/test';
import { collectRuntimeErrors, login } from './helpers';

/**
 * Pages known to embed Recharts components.
 */
const CHART_ROUTES = ['/dashboard', '/revenue', '/admissions', '/occupancy'];

test.describe('Charts & data viz', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of CHART_ROUTES) {
    test(`${route} renders at least one Recharts SVG chart`, async ({ page }) => {
      const errors = collectRuntimeErrors(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => undefined);

      // Recharts emits one or more <svg class="recharts-surface"> elements.
      const charts = page.locator('svg.recharts-surface');
      await expect(charts.first()).toBeVisible({ timeout: 20_000 });
      const count = await charts.count();
      expect(count, `expected >=1 recharts chart on ${route}`).toBeGreaterThan(0);

      // Each chart should have some painted content (paths, rects, or lines).
      const firstChart = charts.first();
      const painted = await firstChart
        .locator('path, rect, circle, line')
        .count();
      expect(painted, 'recharts chart should contain drawn shapes').toBeGreaterThan(0);

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }

  test('chart tooltip appears on hover (dashboard)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle').catch(() => undefined);

    const chart = page.locator('svg.recharts-surface').first();
    await chart.waitFor({ state: 'visible', timeout: 20_000 });

    const box = await chart.boundingBox();
    if (!box) test.skip(true, 'no chart bounding box');

    // Hover over the middle of the chart to trigger a tooltip
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
    await page.mouse.move(box!.x + box!.width / 2 + 10, box!.y + box!.height / 2);

    const tooltip = page.locator('.recharts-tooltip-wrapper');
    // Tooltips can be absent for some chart types - allow soft-pass.
    const visible = await tooltip
      .first()
      .isVisible({ timeout: 4_000 })
      .catch(() => false);
    expect.soft(visible, 'expected a recharts tooltip on hover (best-effort)').toBe(true);
  });
});
