import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: process.env.CI ? [['github'], ['list']] : 'list',

  retries: 3,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
      testDir: './tests',
    },
  ],
});
