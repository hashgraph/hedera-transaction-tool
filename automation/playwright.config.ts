import { defineConfig } from '@playwright/test';

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
  retries: 0,
  timeout: process.env.CI ? 30_000 : 3600_000,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
    },
  ],
});
