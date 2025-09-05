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
      alias: {
        '@renderer': resolve('src/renderer'),
        '@main': resolve('src/main'),
        '@shared': resolve('src/shared'),
      },
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
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
            resolve: {
              alias: {
                '@renderer': resolve('src/renderer'),
                '@main': resolve('src/main'),
                '@shared': resolve('src/shared'),
              },
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
                external: Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
              },
            },
            resolve: {
              alias: {
                '@main': resolve('src/main'),
                '@shared': resolve('src/shared'),
              },
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
