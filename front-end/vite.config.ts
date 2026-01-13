/// <reference types="vitest" />

import { resolve } from 'node:path';
import fs from 'node:fs';

import { defineConfig } from 'vite';

import vue from '@vitejs/plugin-vue';
import electron from 'vite-plugin-electron/simple';
import eslint from 'vite-plugin-eslint';
import vueDevTools from 'vite-plugin-vue-devtools';

import pkg from './package.json';

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  fs.rmSync('dist-electron', { recursive: true, force: true });

  const isServe = command === 'serve';
  const isBuild = command === 'build';
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG;

  return {
    resolve: {
      alias: [
        { find: '@renderer', replacement: resolve('src/renderer') },
        { find: '@main', replacement: resolve('src/main') },
        { find: '@shared', replacement: resolve('src/shared') },
        // Exact match for @prisma/client - don't match @prisma/client/runtime/*
        { find: /^@prisma\/client$/, replacement: resolve('src/generated/prisma/browser.ts') },
      ],
    },
    plugins: [
      vue(),
      vueDevTools(),
      electron({
        main: {
          // Shortcut of `build.lib.entry`
          entry: 'src/main/index.ts',
          vite: {
            build: {
              sourcemap,
              minify: isBuild,
              outDir: 'dist-electron/main',
              rollupOptions: {
                // Exclude @prisma/client from externals so the alias can resolve to generated client
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}).filter(
                  dep => dep !== '@prisma/client',
                ),
              },
            },
            resolve: {
              alias: [
                { find: '@renderer', replacement: resolve('src/renderer') },
                { find: '@main', replacement: resolve('src/main') },
                { find: '@shared', replacement: resolve('src/shared') },
                // Exact match for @prisma/client - don't match @prisma/client/runtime/*
                { find: /^@prisma\/client$/, replacement: resolve('src/generated/prisma/client.ts') },
              ],
            },
          },
        },
        preload: {
          input: 'src/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                // Exclude @prisma/client from externals so the alias can resolve to generated client
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}).filter(
                  dep => dep !== '@prisma/client',
                ),
              },
            },
            resolve: {
              alias: [
                { find: '@main', replacement: resolve('src/main') },
                { find: '@shared', replacement: resolve('src/shared') },
                // Exact match for @prisma/client - don't match @prisma/client/runtime/*
                { find: /^@prisma\/client$/, replacement: resolve('src/generated/prisma/client.ts') },
              ],
            },
          },
        },
      }),
      eslint(),
    ],
    server: {
      port: 8083,
    },
    test: {
      globals: true,
    },
    clearScreen: false,
  };
});
