import { defineConfig } from 'playwright/test';

export default defineConfig({
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  reportSlowTests: null,
  retries: process.env.CI ? 3 : 0,
  timeout: process.env.CI ? 30_000 : 3600_000,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
      testDir: './tests',
    },
  ],
});
