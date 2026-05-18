import { test, expect } from '@playwright/test';
import { collectRuntimeErrors, login, TEST_EMAIL, TEST_PASSWORD } from './helpers';

test.describe('Auth flow', () => {
  test('protected route redirects unauthenticated user to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?callbackUrl=/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();
  });

  test('register page renders the create-account form', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /create account/i })).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
  });

  test('invalid credentials show an error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('does-not-exist@example.com');
    await page.locator('#password').fill('wrong-password-123');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 15_000 });
    // Still on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test('valid credentials sign the user in and land on the dashboard', async ({ page }) => {
    const errors = collectRuntimeErrors(page);
    await login(page, TEST_EMAIL, TEST_PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/);
    // The session cookie was set
    const cookies = await page.context().cookies();
    const hasSession = cookies.some((c) =>
      /session|next-auth/i.test(c.name)
    );
    expect(hasSession, 'expected a next-auth session cookie after login').toBe(true);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('sign-out clears the session', async ({ page }) => {
    await login(page);
    // Try common sign-out triggers
    const signOutButton = page.getByRole('button', { name: /sign out|log out/i }).first();
    const signOutLink = page.getByRole('link', { name: /sign out|log out/i }).first();
    if (await signOutButton.isVisible().catch(() => false)) {
      await signOutButton.click();
    } else if (await signOutLink.isVisible().catch(() => false)) {
      await signOutLink.click();
    } else {
      // Fall back to NextAuth's built-in signout endpoint
      await page.goto('/api/auth/signout');
      const confirm = page.getByRole('button', { name: /sign out/i }).first();
      if (await confirm.isVisible().catch(() => false)) await confirm.click();
    }
    await page.waitForURL(/\/login|\//, { timeout: 15_000 }).catch(() => undefined);
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
