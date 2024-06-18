import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: 3,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
      testDir: './tests',
    },
  ],
});
