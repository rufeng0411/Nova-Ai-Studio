import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/design-canvas',
  timeout: 600_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../artifacts/design-canvas-e2e/report' }]],
  outputDir: '../artifacts/design-canvas-e2e/test-results',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:5173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
