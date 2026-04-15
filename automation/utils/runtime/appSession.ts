import { Page } from '@playwright/test';
import { AppBootstrapper } from '../../services/AppBootstrapper.js';
import type { SetupAppOptions } from '../../services/AppBootstrapper.js';
import type { TransactionToolApp } from './electronAppLauncher.js';

const defaultAppBootstrapper = new AppBootstrapper();

export async function setupApp(options: SetupAppOptions = {}) {
  return defaultAppBootstrapper.setupApp(options);
}

export async function resetAppState(window: Page, app: TransactionToolApp) {
  await defaultAppBootstrapper.resetAppState(window, app);
}

export async function closeApp(app?: TransactionToolApp | null) {
  await defaultAppBootstrapper.closeApp(app);
}

export type { SetupAppOptions } from '../../services/AppBootstrapper.js';
export type { TransactionToolApp } from './electronAppLauncher.js';
