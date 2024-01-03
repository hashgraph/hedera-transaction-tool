import Path from 'path';
import vuePlugin from '@vitejs/plugin-vue';
import eslint from 'vite-plugin-eslint';

import { defineConfig } from 'vite';

/**
 * https://vitejs.dev/config
 */
export default defineConfig({
  root: Path.join(__dirname, 'src', 'renderer'),
  publicDir: 'public',
  server: {
    port: 8080,
  },
  build: {
    outDir: Path.join(__dirname, 'build', 'renderer'),
    emptyOutDir: true,
  },
  plugins: [vuePlugin(), eslint()],
});
