import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@renderer': resolve('src/renderer'),
      '@shared': resolve('src/shared'),
    },
  },
  test: {
    globals: true,
    include: ['src/tests/e2e/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
