import { expect, test } from '@playwright/test';

// Happy-path: admin logs in via the form, lands on /sedes, sees the seeded
// stores. Backbone of every other E2E suite — if this fails, the rest can't
// run. Future flows (sale, intake, transfer, audit) follow the same shape:
//   1. Authenticate via UI.
//   2. Drive a real domain action.
//   3. Assert on what the cashier/encargada/admin actually sees.
//
// Mobile-first: the assertions only target copy and roles, not bounding
// boxes — so the same suite passes across the four device projects in
// playwright.config.ts.

test.describe('Login flow', () => {
  test('admin signs in and reaches the sucursal picker', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel(/email/i).fill('admin@demo.local');
    await page.getByLabel(/contraseña|password/i).fill('Admin1234');
    await page.getByRole('button', { name: /ingresar|iniciar sesión|login/i }).click();

    // After login the app navigates to /sedes; the picker shows the seeded
    // stores by name. We wait for any of them as the success signal.
    await expect(page).toHaveURL(/\/sedes/, { timeout: 10_000 });
    await expect(page.getByText(/Sucursal Prado|Sucursal Zona Sur|Almacén/i).first()).toBeVisible();
  });

  test('rejects wrong password with an inline error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('admin@demo.local');
    await page.getByLabel(/contraseña|password/i).fill('definitely-wrong');
    await page.getByRole('button', { name: /ingresar|iniciar sesión|login/i }).click();

    // Stays on /login and surfaces an error alert. The exact copy may evolve
    // (Spanish wording polish), so we match on the role rather than text.
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5_000 });
  });
});
