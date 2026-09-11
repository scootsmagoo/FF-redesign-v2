import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke suite. Runs against an already-deployed site (staging by default) or a
 * local dev server:
 *   pnpm --filter @ff/storefront e2e                              → staging
 *   E2E_BASE_URL=http://localhost:4321 pnpm --filter @ff/storefront e2e
 * The checkout test places a real order on the target, so it only runs where the payment
 * provider is the stub (the payment page exposes the `stub_ok` token).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'https://filtersfast-storefront.adam-021.workers.dev';

export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    userAgent: 'FiltersFast-e2e (Playwright)',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] }, testMatch: /smoke\.spec\.ts/ },
  ],
});
