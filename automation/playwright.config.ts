import { defineConfig } from '@playwright/test';

const configuredWorkers = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? '', 10);
const workers = Number.isFinite(configuredWorkers) && configuredWorkers > 0
  ? configuredWorkers
  : 1;

export default defineConfig({
  testDir: './tests',
  reporter: process.env.CI
    ? [['github'], ['list'], ['html', { outputFolder: 'reports/playwright', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'reports/playwright', open: 'on-failure' }]],
  use: {
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true,
    },
    trace: 'retain-on-failure',
  },
  reportSlowTests: null,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 180_000 : 3600_000,
  fullyParallel: false,
  workers,

  projects: [
    {
      name: 'Transaction tool',
    },
  ],
});
