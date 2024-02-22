import {defineWorkspace} from 'vitest/config';

/**
 * Configuration for the global end-to-end testing,
 * placed in the project's root 'tests' folder.
 */

export default defineWorkspace([
  'packages/*',
  {
    test: {
      name: 'e2e',
      /**
       * For e2e tests, have vitest search only in the project root 'tests' folder.
       */
      include: ['./tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
      /**
       * The default timeout of 5000ms is sometimes not enough for playwright.
       */
      testTimeout: 30_000,
      hookTimeout: 30_000,
    },
  },
]);
