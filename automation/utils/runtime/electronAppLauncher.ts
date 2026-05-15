import {
  _electron as electron,
  chromium,
  type Browser,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import * as dotenv from 'dotenv';
import { ELECTRON_APP_MODES } from '../../constants/index.js';
import { getElectronAppMode, type TransactionToolAppMode } from './appMode.js';
import { applyPlaywrightIsolationEnv } from '../setup/playwrightIsolation.js';

export type { TransactionToolAppMode } from './appMode.js';

dotenv.config();

const DEFAULT_ATTACH_URL = 'http://127.0.0.1:9222';
const DEFAULT_ATTACH_TIMEOUT_MS = 30_000;
const WINDOW_POLL_INTERVAL_MS = 250;
const LAUNCH_ATTEMPTS = 2;

export interface TransactionToolApp {
  readonly mode: TransactionToolAppMode;
  firstWindow(): Promise<Page>;
  close(): Promise<void>;
}

export interface LaunchHederaTransactionToolOptions {
  mode?: TransactionToolAppMode;
}

class LaunchedTransactionToolApp implements TransactionToolApp {
  readonly mode = ELECTRON_APP_MODES.LAUNCH;

  constructor(private readonly app: ElectronApplication) {}

  async firstWindow(): Promise<Page> {
    return await this.app.firstWindow();
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}

class AttachedTransactionToolApp implements TransactionToolApp {
  readonly mode = ELECTRON_APP_MODES.ATTACH;

  constructor(private readonly browser: Browser) {}

  async firstWindow(): Promise<Page> {
    return await waitForAttachedWindow(this.browser, getAttachTimeoutMs());
  }

  async close(): Promise<void> {
    console.log('[ElectronLauncher] Leaving attached Electron app running.');
  }
}

let attachedAppPromise: Promise<TransactionToolApp> | null = null;

export async function launchHederaTransactionTool(
  { mode = getElectronAppMode() }: LaunchHederaTransactionToolOptions = {},
): Promise<TransactionToolApp> {
  if (mode === ELECTRON_APP_MODES.ATTACH) {
    return await attachToHederaTransactionTool();
  }

  return await launchNewHederaTransactionTool();
}

async function launchNewHederaTransactionTool(): Promise<TransactionToolApp> {
  const executablePath = process.env.EXECUTABLE_PATH;
  const isolationContext = applyPlaywrightIsolationEnv();

  if (!executablePath) {
    console.error('[ElectronLauncher] EXECUTABLE_PATH is not defined.');
    throw new Error('EXECUTABLE_PATH environment variable is required.');
  }

  console.log('[ElectronLauncher] Launching Hedera Transaction Tool...');
  console.log(`[ElectronLauncher] Executable path: ${executablePath}`);
  if (isolationContext) {
    console.log(`[ElectronLauncher] Namespace: ${isolationContext.namespace}`);
    console.log(`[ElectronLauncher] userData dir: ${isolationContext.userDataDir}`);
    console.log(`[ElectronLauncher] Session partition: ${isolationContext.sessionPartition}`);
  }

  const launchStart = Date.now();
  const launchArgs = [
    '--ignore-certificate-errors',
    // Optional CI stability flags (safe to keep; they reduce flakiness on Linux runners)
    '--no-sandbox',
    '--disable-dev-shm-usage',
  ];

  if (isolationContext?.userDataDir) {
    launchArgs.push(`--user-data-dir=${isolationContext.userDataDir}`);
  }

  const app = await launchElectronWithRetry(executablePath, launchArgs);
  const wrappedApp = new LaunchedTransactionToolApp(app);

  const launchTime = Date.now() - launchStart;
  console.log(`[ElectronLauncher] Electron process launched in ${launchTime} ms`);

  const windowStart = Date.now();

  const firstWindow = await wrappedApp.firstWindow();
  await firstWindow.waitForLoadState('domcontentloaded');

  const windowTime = Date.now() - windowStart;
  console.log(`[ElectronLauncher] First window ready in ${windowTime} ms`);

  return wrappedApp;
}

async function launchElectronWithRetry(
  executablePath: string,
  launchArgs: string[],
): Promise<ElectronApplication> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= LAUNCH_ATTEMPTS; attempt++) {
    try {
      return await electron.launch({
        executablePath,
        env: {
          ...process.env,
          PLAYWRIGHT_TEST: 'true',
        },
        // These args are passed to Electron/Chromium. `user-data-dir` must be isolated before app code runs.
        args: launchArgs,
      });
    } catch (error) {
      lastError = error;

      if (attempt === LAUNCH_ATTEMPTS || !isRetriableLaunchError(error)) {
        throw error;
      }

      console.log(
        `[ElectronLauncher] Electron launch attempt ${attempt} failed; retrying: ${
          error instanceof Error ? error.message : error
        }`,
      );
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

function isRetriableLaunchError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('socket hang up') || message.includes('Process failed to launch');
}

async function attachToHederaTransactionTool(): Promise<TransactionToolApp> {
  if (!attachedAppPromise) {
    attachedAppPromise = createAttachedTransactionToolApp().catch(error => {
      attachedAppPromise = null;
      throw error;
    });
  }

  return await attachedAppPromise;
}

async function createAttachedTransactionToolApp(): Promise<TransactionToolApp> {
  const endpointURL = getAttachEndpointURL();
  const timeout = getAttachTimeoutMs();

  console.log('[ElectronLauncher] Attaching to an existing Hedera Transaction Tool instance...');
  console.log(`[ElectronLauncher] CDP endpoint: ${endpointURL}`);

  const attachStart = Date.now();
  const browser = await chromium.connectOverCDP(endpointURL, { timeout });
  const wrappedApp = new AttachedTransactionToolApp(browser);

  const attachTime = Date.now() - attachStart;
  console.log(`[ElectronLauncher] Attached to Electron in ${attachTime} ms`);

  const windowStart = Date.now();
  const firstWindow = await wrappedApp.firstWindow();
  await firstWindow.waitForLoadState('domcontentloaded');

  const windowTime = Date.now() - windowStart;
  console.log(`[ElectronLauncher] Attached window ready in ${windowTime} ms`);

  return wrappedApp;
}

function getAttachEndpointURL(): string {
  const attachURL = process.env.ELECTRON_ATTACH_URL?.trim();
  if (attachURL) {
    return attachURL;
  }

  const remoteDebuggingPort = process.env.ELECTRON_REMOTE_DEBUGGING_PORT?.trim();
  if (remoteDebuggingPort) {
    return `http://127.0.0.1:${remoteDebuggingPort}`;
  }

  return DEFAULT_ATTACH_URL;
}

function getAttachTimeoutMs(): number {
  const rawTimeout = process.env.ELECTRON_ATTACH_TIMEOUT_MS?.trim();
  if (!rawTimeout) {
    return DEFAULT_ATTACH_TIMEOUT_MS;
  }

  const timeout = Number(rawTimeout);
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new Error(
      `Invalid ELECTRON_ATTACH_TIMEOUT_MS "${rawTimeout}". Expected a positive number.`,
    );
  }

  return timeout;
}

async function waitForAttachedWindow(browser: Browser, timeoutMs: number): Promise<Page> {
  const startedAt = Date.now();
  let lastSeenUrls: string[] = [];

  while (Date.now() - startedAt < timeoutMs) {
    const pages = browser
      .contexts()
      .flatMap(context => context.pages());

    lastSeenUrls = pages.map(page => page.url());

    const firstWindow = pages.find(isAppWindow);
    if (firstWindow) {
      await firstWindow.bringToFront();
      return firstWindow;
    }

    await new Promise(resolve => setTimeout(resolve, WINDOW_POLL_INTERVAL_MS));
  }

  const details =
    lastSeenUrls.length > 0
      ? ` Seen targets: ${lastSeenUrls.join(', ')}`
      : ' No attachable page targets were discovered.';

  throw new Error(`[ElectronLauncher] Timed out waiting for an Electron window.${details}`);
}

function isAppWindow(page: Page): boolean {
  if (page.isClosed()) {
    return false;
  }

  const url = page.url();
  return !url.startsWith('devtools://') && !url.startsWith('chrome-extension://');
}
