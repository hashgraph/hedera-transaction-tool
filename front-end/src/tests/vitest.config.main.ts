import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      { find: '@main', replacement: resolve('src/main') },
      { find: '@shared', replacement: resolve('src/shared') },
      // Prisma 7 with custom output path - redirect @prisma/client to generated client
      // but allow subpaths like @prisma/client/runtime/client to resolve from node_modules
      { find: /^@prisma\/client$/, replacement: resolve('src/generated/prisma/client.ts') },
    ],
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
