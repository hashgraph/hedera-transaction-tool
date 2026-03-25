import {
  _electron as electron,
  chromium,
  type Browser,
  type ElectronApplication,
  type Page,
} from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const DEFAULT_ATTACH_URL = 'http://127.0.0.1:9222';
const DEFAULT_ATTACH_TIMEOUT_MS = 30_000;
const WINDOW_POLL_INTERVAL_MS = 250;

export type TransactionToolAppMode = 'launch' | 'attach';

export interface TransactionToolApp {
  readonly mode: TransactionToolAppMode;
  firstWindow(): Promise<Page>;
  close(): Promise<void>;
}

export interface LaunchHederaTransactionToolOptions {
  mode?: TransactionToolAppMode;
}

class LaunchedTransactionToolApp implements TransactionToolApp {
  readonly mode = 'launch';

  constructor(private readonly app: ElectronApplication) {}

  async firstWindow(): Promise<Page> {
    return await this.app.firstWindow();
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}

class AttachedTransactionToolApp implements TransactionToolApp {
  readonly mode = 'attach';

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
  { mode = getLaunchMode() }: LaunchHederaTransactionToolOptions = {},
): Promise<TransactionToolApp> {
  if (mode === 'attach') {
    return await attachToHederaTransactionTool();
  }

  return await launchNewHederaTransactionTool();
}

function getLaunchMode(): TransactionToolAppMode {
  const mode = process.env.ELECTRON_APP_MODE?.trim() ?? 'launch';

  if (mode === 'launch' || mode === 'attach') {
    return mode;
  }

  throw new Error(
    `Invalid ELECTRON_APP_MODE "${mode}". Expected "launch" or "attach".`,
  );
}

async function launchNewHederaTransactionTool(): Promise<TransactionToolApp> {
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
    env: {
      ...process.env,
      PLAYWRIGHT_TEST: 'true',
    },
    // These args are passed to Electron/Chromium. Crucial for CI when using mkcert/self-signed TLS.
    args: [
      '--ignore-certificate-errors',
      // Optional CI stability flags (safe to keep; they reduce flakiness on Linux runners)
      '--no-sandbox',
      '--disable-dev-shm-usage',
    ],
  });
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
