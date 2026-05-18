# Playwright E2E tests

End-to-end tests for the Avenues Clinic Intelligence Platform.

## Layout

```
tests/
  helpers.ts            - shared login() + error collectors
  auth.spec.ts          - login, register, redirect, sign-out
  dashboard.spec.ts     - 12 protected routes render without runtime errors
  charts.spec.ts        - Recharts SVGs render + tooltip on hover
  navigation.spec.ts    - sidebar links + active-state styling
  smoke.mobile.spec.ts  - mobile viewport smoke (Pixel 7)
playwright.config.ts    - base URL, projects, reporter
```

The legacy spec at `scripts/uat-playwright.spec.ts` is **not** picked up by
`playwright.config.ts` (testDir is `./tests`). Run it explicitly if you want it.

## Prerequisites (one-time)

```bash
npm install --save-dev @playwright/test    # already in node_modules
npx playwright install chromium             # downloads ~180MB browser
```

## Running

Start the dev server in one terminal:

```bash
npm run dev          # defaults to http://localhost:3000
```

In another terminal:

```bash
# All tests, desktop only
npx playwright test

# Single file
npx playwright test tests/auth.spec.ts

# Mobile project (Pixel 7)
npx playwright test --project=mobile-chrome

# Watch mode UI
npx playwright test --ui

# Against a different URL (e.g. UAT on :3100)
BASE_URL=http://localhost:3100 npx playwright test
```

After a run, open the HTML report:

```bash
npx playwright show-report
```

## Environment variables

| Var             | Default                  | What it does                 |
| --------------- | ------------------------ | ---------------------------- |
| `BASE_URL`      | `http://localhost:3000`  | The app to test              |
| `TEST_EMAIL`    | `admin@avenues.clinic`   | Seeded admin from `prisma/seed.ts` |
| `TEST_PASSWORD` | `admin123`               | Seeded admin password        |

## Regression covered

The May 18 UAT run captured this bug:

When running locally on `http://localhost:3100`, the app's `/forgot-password`
page issues an RSC fetch to **`https://mil-analytics-dashboard.vercel.app/login?callbackUrl=%2Fforgot-password`**,
which then fails CORS:

```
Access to fetch at 'https://mil-analytics-dashboard.vercel.app/login?...'
(redirected from 'http://localhost:3100/forgot-password?_rsc=17yrj')
from origin 'http://localhost:3100' has been blocked by CORS policy:
Request header field rsc is not allowed by Access-Control-Allow-Headers
in preflight response.
```

`tests/cors-regression.spec.ts` covers this now. It asserts that `/login` and
protected-route middleware redirects never point away from the request origin.
