import { Page, test } from '@playwright/test';
import { LoginPage } from '../../../pages/LoginPage.js';
import { TransactionPage } from '../../../pages/TransactionPage.js';
import { closeApp, setupApp, type TransactionToolApp } from '../../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../../utils/runtime/environment.js';
import {
  createSeededLocalUserSession,
  type SeededLocalUser,
} from '../../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../../utils/setup/sharedTestEnvironment.js';

export function setupLocalTransactionSuite() {
  let app: TransactionToolApp;
  let window: Page;
  let loginPage: LoginPage;
  let transactionPage: TransactionPage;
  let seededUser: SeededLocalUser;
  let isolationContext: ActivatedTestIsolationContext | null = null;

  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    seededUser = await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupTransactionEnvironment();
  });

  async function setupTransactionEnvironment(privateKey?: string) {
    await setupEnvironmentForTransactions(window, privateKey);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  }

  async function reloadSession() {
    await closeApp(app);
    ({ app, window } = await setupApp({ preserveLocalState: true }));
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);

    if (await loginPage.isSettingsButtonVisible()) {
      await loginPage.waitForElementToBeVisible(loginPage.settingsButtonSelector);
    } else {
      await loginPage.assertSignInMode('reloaded local transaction session');
      await loginPage.login(seededUser.email, seededUser.password);
      await loginPage.waitForElementToBeVisible(loginPage.settingsButtonSelector);
    }

    await setupTransactionEnvironment();
  }

  return {
    get window() {
      return window;
    },
    get loginPage() {
      return loginPage;
    },
    get transactionPage() {
      return transactionPage;
    },
    reloadSession,
    setupTransactionEnvironment,
  };
}
