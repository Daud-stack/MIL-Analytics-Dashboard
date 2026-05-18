import { test, expect } from '@playwright/test';
import { collectRuntimeErrors, expectMainHeading, login } from './helpers';

const ROUTES = ['/dashboard', '/drilldown', '/ward-beds'];

test.describe('Mobile smoke', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const route of ROUTES) {
    test(`${route} renders on mobile without horizontal overflow`, async ({ page }) => {
      const errors = collectRuntimeErrors(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => undefined);

      await expectMainHeading(page);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth > window.innerWidth + 8;
      });
      expect(overflow, `${route} should not force horizontal scrolling`).toBe(false);

      expect(errors, errors.join('\n')).toEqual([]);
    });
  }
});
