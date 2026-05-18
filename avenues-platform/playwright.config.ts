import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Avenues Clinic Intelligence Platform.
 *
 * - Tests live in ./tests
 * - The legacy UAT spec at scripts/uat-playwright.spec.ts is still picked up
 *   when explicitly run via `npx playwright test scripts/`.
 * - Override the target URL/credentials via env vars:
 *     BASE_URL, TEST_EMAIL, TEST_PASSWORD
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
      testMatch: /.*\.mobile\.spec\.ts$/,
    },
  ],
});
