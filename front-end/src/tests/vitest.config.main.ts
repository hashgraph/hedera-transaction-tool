import { resolve } from 'path';
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
    environment: 'node',
    globals: true,
    include: ['src/tests/main/**/*.{test,spec}.{ts,js}'],
    coverage: {
      exclude: ['src/shared', 'src/main/electron-env.d.ts'],
    },
  },
});
