import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@shared': resolve('src/shared'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/tests/main/**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      include: ['src/main/modules/logger.ts'],
      exclude: ['src/shared', 'src/main/electron-env.d.ts'],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
});
