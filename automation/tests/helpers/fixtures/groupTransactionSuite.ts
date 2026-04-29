import { Page, test } from '@playwright/test';
import { GroupPage } from '../../../pages/GroupPage.js';
import { LoginPage } from '../../../pages/LoginPage.js';
import { TransactionPage } from '../../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../../utils/runtime/environment.js';
import { createSeededLocalUserSession } from '../../../utils/seeding/localUserSeeding.js';
import { setupLocalSuiteApp, teardownLocalSuiteApp } from '../bootstrap/localSuiteBootstrap.js';
import { GroupTransactionAssertions } from '../assertions/groupTransactionAssertions.js';
import { prepareGroupTransactionPage } from '../flows/groupTransactionNavigationFlow.js';
import type { ActivatedTestIsolationContext } from '../../../utils/setup/sharedTestEnvironment.js';

export function setupGroupTransactionSuite() {
  let app: TransactionToolApp;
  let window: Page;
  let loginPage: LoginPage;
  let transactionPage: TransactionPage;
  let groupPage: GroupPage;
  let groupAssertions: GroupTransactionAssertions;
  let isolationContext: ActivatedTestIsolationContext | null = null;

  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    groupPage = new GroupPage(window);
    groupAssertions = new GroupTransactionAssertions(transactionPage);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await prepareGroupTransactionPage({ transactionPage, groupPage });
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  return {
    get transactionPage() {
      return transactionPage;
    },
    get groupPage() {
      return groupPage;
    },
    get groupAssertions() {
      return groupAssertions;
    },
  };
}
