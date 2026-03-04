import { _electron as electron } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

export async function launchHederaTransactionTool() {
  const executablePath = process.env.EXECUTABLE_PATH;

  if (!executablePath) {
    console.error('[ElectronLauncher] EXECUTABLE_PATH is not defined.');
    throw new Error('EXECUTABLE_PATH environment variable is required.');
  }

  console.log('[ElectronLauncher] Launching Hedera Transaction Tool...');
  console.log(`[ElectronLauncher] Executable path: ${executablePath}`);

  const launchStart = Date.now();

  const app = await electron.launch({
    executablePath,
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
