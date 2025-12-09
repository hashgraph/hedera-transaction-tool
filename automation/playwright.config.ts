import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
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
