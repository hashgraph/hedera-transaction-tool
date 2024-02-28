import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vite.config.js',
    test: {
      name: 'renderer',
      environment: 'happy-dom',
      globals: true,
      include: ['./src/tests/main/**/*.{test,spec}.{ts,js}'],
    },
  },
  {
    extends: './vite.config.js',
    test: {
      name: 'main',
      environment: 'node',
      globals: true,
      include: ['./src/tests/main/**/*.{test,spec}.{ts,js}'],
    },
  },
  {
    extends: './vite.config.js',
    test: {
      name: 'e2e',
      globals: true,
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
