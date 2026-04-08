import type { Page, TestInfo } from '@playwright/test';
import { LoginPage } from '../../../pages/LoginPage.js';
import { OrganizationPage } from '../../../pages/OrganizationPage.js';
import { RegistrationPage } from '../../../pages/RegistrationPage.js';
import { TransactionPage } from '../../../pages/TransactionPage.js';
import {
  closeApp,
  setupApp,
  type TransactionToolApp,
} from '../../../utils/runtime/appSession.js';
import {
  activateSuiteIsolation,
  cleanupIsolation,
  createNamespacedLabel,
  resetBackendStateForSuite,
  resetBackendStateForTeardown,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../../../utils/setup/sharedTestEnvironment.js';

export interface OrganizationSuiteAppContext {
  app: TransactionToolApp;
  window: Page;
  loginPage: LoginPage;
  transactionPage: TransactionPage;
  organizationPage: OrganizationPage;
  isolationContext: ActivatedTestIsolationContext | null;
}

export interface NamedOrganizationSuiteAppContext extends OrganizationSuiteAppContext {
  registrationPage: RegistrationPage;
  organizationNickname: string;
}

export async function setupOrganizationSuiteApp(
  testInfo: Pick<TestInfo, 'file' | 'parallelIndex' | 'retry'>,
): Promise<OrganizationSuiteAppContext> {
  const isolationContext = await activateSuiteIsolation(testInfo);
  await resetLocalStateForSuite();
  await resetBackendStateForSuite();

  const { app, window } = await setupApp();

  return {
    app,
    window,
    loginPage: new LoginPage(window),
    transactionPage: new TransactionPage(window),
    organizationPage: new OrganizationPage(window),
    isolationContext,
  };
}

export async function setupNamedOrganizationSuiteApp(
  testInfo: Pick<TestInfo, 'file' | 'parallelIndex' | 'retry'>,
  baseOrganizationNickname = 'Test Organization',
): Promise<NamedOrganizationSuiteAppContext> {
  const context = await setupOrganizationSuiteApp(testInfo);

  return {
    ...context,
    registrationPage: new RegistrationPage(context.window),
    organizationNickname: createNamespacedLabel(baseOrganizationNickname, context.isolationContext),
  };
}

export async function teardownOrganizationSuiteApp(
  app: TransactionToolApp,
  isolationContext: ActivatedTestIsolationContext | null,
) {
  await closeApp(app);
  await resetLocalStateForTeardown();
  await resetBackendStateForTeardown();
  await cleanupIsolation(isolationContext);
}
