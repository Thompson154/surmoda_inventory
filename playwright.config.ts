import { defineConfig, devices } from '@playwright/test';

// Mobile-first per the user's locked decision (Q3): primary targets are
// iPhone + Android Pixel + iPad; desktop runs only as a fallback project.
//
// Tests live in `tests/e2e/`. The dev servers (API on :3000, Vite on :5173)
// must be up BEFORE running `npx playwright test`. We deliberately do NOT
// auto-spawn them via `webServer` — running migrations + seed live in CI is
// out of scope for this scaffolding pass and mixing it in here would couple
// E2E to a specific DB lifecycle. Add `webServer: { ... }` here when the
// deploy pipeline lands.

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'Mobile Chrome (Pixel 7)',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'Mobile Safari (iPhone 14)',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'Tablet (iPad Mini)',
      use: { ...devices['iPad Mini'] },
    },
    // Desktop fallback runs last; not the primary contract per Q3.
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
