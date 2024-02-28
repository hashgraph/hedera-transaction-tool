import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@main': resolve('src/main'),
      '@renderer': resolve('src/renderer'),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
});
