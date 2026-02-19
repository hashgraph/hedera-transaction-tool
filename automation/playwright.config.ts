import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  reportSlowTests: null,
  retries: process.env.CI ? 2 : 0,
  timeout: process.env.CI ? 60_000 : 3600_000,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
    },
  ],
});
