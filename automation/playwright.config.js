import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Global configuration options
  retries: 3, // Give failing tests 3 retry attempts

  projects: [
    {
      name: 'Transaction tool',
      testDir: './tests',
      use: {
        channel: 'chrome',
      },
    },
  ],
});
