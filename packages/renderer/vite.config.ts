/* eslint-env node */
/// <reference types="vitest" />

import {join} from 'node:path';

import {chrome} from '../../.electron-vendors.cache.json';

import vue from '@vitejs/plugin-vue';
import eslintPlugin from 'vite-plugin-eslint';

import {renderer} from 'unplugin-auto-expose';
import {defineConfig} from 'vite';

const PACKAGE_ROOT = __dirname;
const PROJECT_ROOT = join(PACKAGE_ROOT, '../..');

export default defineConfig({
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PROJECT_ROOT,
  resolve: {
    alias: {
      '@renderer': join(PACKAGE_ROOT, 'src'),
    },
  },
  base: '',
  server: {
    fs: {
      strict: true,
    },
  },
  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      input: join(PACKAGE_ROOT, 'index.html'),
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  test: {
    environment: 'happy-dom',
  },
  plugins: [
    vue(),
    renderer.vite({
      preloadEntry: join(PACKAGE_ROOT, '../preload/src/index.ts'),
    }),
    eslintPlugin(),
  ],
});
