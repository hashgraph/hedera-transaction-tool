import { defineConfig } from 'playwright/test';

export default defineConfig({
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  reportSlowTests: null,
  retries: 3,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
      testDir: './tests',
    },
  ],
});
