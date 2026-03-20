import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
    },
  },
  test: {
    watch: false,
    environment: 'node',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/tests/shared/**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.ts'],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
