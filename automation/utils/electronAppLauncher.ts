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

  const startTime = Date.now();

  const app = await electron.launch({
    executablePath,
  });

  const launchTime = Date.now() - startTime;
  console.log(`[ElectronLauncher] Electron app launched in ${launchTime} ms`);

  return app;
}
