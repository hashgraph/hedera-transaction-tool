import type { Page, TestInfo } from '@playwright/test';
import {
  closeApp,
  setupApp,
  type TransactionToolApp,
} from '../../../utils/runtime/appSession.js';
import {
  activateSuiteIsolation,
  cleanupIsolation,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../../../utils/setup/sharedTestEnvironment.js';

export interface LocalSuiteAppContext {
  app: TransactionToolApp;
  window: Page;
  isolationContext: ActivatedTestIsolationContext | null;
}

export async function setupLocalSuiteApp(
  testInfo: Pick<TestInfo, 'file' | 'parallelIndex' | 'retry'>,
): Promise<LocalSuiteAppContext> {
  const isolationContext = await activateSuiteIsolation(testInfo);
  await resetLocalStateForSuite();
  const { app, window } = await setupApp();

  return {
    app,
    window,
    isolationContext,
  };
}

export async function teardownLocalSuiteApp(
  app: TransactionToolApp,
  isolationContext: ActivatedTestIsolationContext | null,
) {
  await closeApp(app);
  await resetLocalStateForTeardown();
  await cleanupIsolation(isolationContext);
}
