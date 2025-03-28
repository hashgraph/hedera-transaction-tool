import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['src/tests/main/**/*.{test,spec}.{ts,js}'],
    watch: false,
    coverage: {
      exclude: ['src/main/shared', 'src/main/electron-env.d.ts'],
    },
  },
});
