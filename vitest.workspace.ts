import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: './vite.config.ts',
    test: {
      name: 'main',
      environment: 'node',
      include: ['src/tests/main/**/*.{test,spec}.{ts,js}'],
    },
  },
  {
    extends: './vite.config.ts',
    test: {
      name: 'renderer',
      environment: 'happy-dom',
      include: ['src/tests/renderer/**/*.{test,spec}.{ts,js}'],
    },
  },
]);
