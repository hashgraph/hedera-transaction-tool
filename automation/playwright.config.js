import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: process.env.CI
    ? ['github', ['list'], ['allure-playwright']]
    : [['list'], ['allure-playwright']],

  retries: 3,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
      testDir: './tests',
    },
  ],
});
