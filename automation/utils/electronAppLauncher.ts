import { _electron as electron, type ElectronApplication } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export async function launchHederaTransactionTool(): Promise<ElectronApplication> {
  const executablePath = process.env.EXECUTABLE_PATH;
  const videoDir = process.env.PW_ELECTRON_VIDEO_DIR || 'test-results/electron-videos';

  if (!executablePath) {
    console.error('[ElectronLauncher] EXECUTABLE_PATH is not defined.');
    throw new Error('EXECUTABLE_PATH environment variable is required.');
  }

  console.log('[ElectronLauncher] Launching Hedera Transaction Tool...');
  console.log(`[ElectronLauncher] Executable path: ${executablePath}`);

  const launchStart = Date.now();

  const app = await electron.launch({
    executablePath,
    recordVideo: {
      dir: videoDir,
    },
    // These args are passed to Electron/Chromium. Crucial for CI when using mkcert/self-signed TLS.
    args: [
      '--ignore-certificate-errors',
      // Optional CI stability flags (safe to keep; they reduce flakiness on Linux runners)
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });

  const launchTime = Date.now() - launchStart;
  console.log(`[ElectronLauncher] Electron process launched in ${launchTime} ms`);

  const windowStart = Date.now();

  const firstWindow = await app.firstWindow();
  await firstWindow.waitForLoadState('domcontentloaded');

  const windowTime = Date.now() - windowStart;
  console.log(`[ElectronLauncher] First window ready in ${windowTime} ms`);

  return app;
}
