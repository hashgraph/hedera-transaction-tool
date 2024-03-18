/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    DIST_ELECTRON: string;
    DIST: string;
  }
}
