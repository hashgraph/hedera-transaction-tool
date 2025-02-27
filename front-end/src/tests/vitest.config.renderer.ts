/**
 * @vitest-environment jsdom
 */
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

import vue from '@vitejs/plugin-vue';

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@renderer': resolve('src/renderer'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/tests/renderer/**/*.{test,spec}.{ts,js}'],
  },
  plugins: [vue()],
});
