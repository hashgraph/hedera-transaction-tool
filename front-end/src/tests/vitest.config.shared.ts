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
    include: ['src/tests/shared/**/*.{test,spec}.{ts,js}'],
  },
});
