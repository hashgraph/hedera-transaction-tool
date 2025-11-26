import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  reportSlowTests: null,
  retries: 0,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
    },
  ],
});
