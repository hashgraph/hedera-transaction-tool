import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

import vue from '@vitejs/plugin-vue';

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
    include: ['src/tests/renderer/**/*.{test,spec}.{ts,js}'],
  },
  plugins: [vue()],
});
