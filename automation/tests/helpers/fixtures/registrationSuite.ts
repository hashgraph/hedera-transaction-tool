import { Page, test } from '@playwright/test';
import { LoginPage } from '../../../pages/LoginPage.js';
import { RegistrationPage } from '../../../pages/RegistrationPage.js';
import { TransactionPage } from '../../../pages/TransactionPage.js';
import { closeApp, setupApp, type TransactionToolApp } from '../../../utils/runtime/appSession.js';
import { generateRandomEmail, generateRandomPassword } from '../../../utils/data/random.js';
import {
  activateTestIsolation,
  cleanupIsolation,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../../../utils/setup/sharedTestEnvironment.js';

export function setupRegistrationSuite() {
  let app: TransactionToolApp | undefined;
  let window: Page;
  let registrationPage: RegistrationPage;
  let loginPage: LoginPage;
  let transactionPage: TransactionPage;
  let isolationContext: ActivatedTestIsolationContext | null = null;
  const credentials = { email: '', password: '' };

  test.beforeEach(async ({}, testInfo) => {
    if (app) {
      await closeApp(app);
      app = undefined;
    }
    isolationContext = await activateTestIsolation(testInfo);
    await resetLocalStateForSuite();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    await loginPage.assertRegistrationMode('registration test bootstrap');
  });

  test.afterEach(async () => {
    await closeApp(app);
    app = undefined;
    await resetLocalStateForTeardown();
    await cleanupIsolation(isolationContext);
    isolationContext = null;
  });

  test.afterAll(async () => {
    if (app) {
      await closeApp(app);
    }
    await cleanupIsolation(isolationContext);
  });

  function createCredentials() {
    credentials.email = generateRandomEmail();
    credentials.password = generateRandomPassword();

    return credentials;
  }

  return {
    get credentials() {
      return credentials;
    },
    get registrationPage() {
      return registrationPage;
    },
    get loginPage() {
      return loginPage;
    },
    get transactionPage() {
      return transactionPage;
    },
    createCredentials,
  };
}
