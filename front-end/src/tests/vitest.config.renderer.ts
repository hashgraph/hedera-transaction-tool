import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

import vue from '@vitejs/plugin-vue';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@main', replacement: resolve('src/main') },
      { find: '@renderer', replacement: resolve('src/renderer') },
      { find: '@shared', replacement: resolve('src/shared') },
      { find: /^@prisma\/client$/, replacement: resolve('src/generated/prisma/browser.ts') },
    ],
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/tests/setup.ts'],
    include: ['src/tests/renderer/**/*.{test,spec}.{ts,js}'],
    coverage: {
      provider: 'v8',
      include: ['src/renderer/utils/logger.ts'],
      thresholds: {
        branches: 90,
        functions: 90,
        lines: 90,
        statements: 90,
      },
    },
  },
  plugins: [vue()],
});
