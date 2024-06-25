import { defineConfig } from '@playwright/test';
import * as os from 'os';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default defineConfig({
  reporter: process.env.CI
    ? [
        'github',
        ['list'],
        [
          'allure-playwright',
          {
            detail: true,
            suiteTitle: false,
            environmentInfo: {
              os_platform: os.platform(),
              os_version: os.version(),
              node_version: process.version,
              ENVIRONMENT: process.env.ENVIRONMENT,
            },
          },
        ],
      ]
    : [
        ['list'],
        [
          'allure-playwright',
          {
            detail: true,
            suiteTitle: false,
            environmentInfo: {
              os_platform: os.platform(),
              os_version: os.version(),
              node_version: process.version,
              ENVIRONMENT: process.env.ENVIRONMENT,
            },
          },
        ],
      ],

  retries: 3,
  workers: 1,

  projects: [
    {
      name: 'Transaction tool',
      testDir: './tests',
    },
  ],
});
