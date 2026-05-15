import { Page, expect, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import { seedHistoryTransactions } from '../../utils/db/seedTransactionRecords.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

// 4.4.4: History.vue uses AppPager with default pageSize 10. The query filters
// rows by `user_id` and `network`. New seeded users default to MAINNET
// (`storeNetwork.setup`), so we seed with that network to ensure visibility.
// Asserting via row counts rather than description text — see 4.3.3 for the
// reasoning around substring collisions.
const TOTAL_HISTORY_ROWS = 11;
const PAGE_SIZE = 10;
const SEEDED_NETWORK = 'mainnet';

test.describe('Transaction history pagination tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
  });

  test('Verify history table paginates at 10 items per page', async () => {
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    await seedHistoryTransactions(seededUser.userId, TOTAL_HISTORY_ROWS, SEEDED_NETWORK);

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
    await transactionPage.clickOnHistoryTab();

    expect(await transactionPage.isPagerMultiPageVisible()).toBe(true);

    await expect.poll(() => transactionPage.getHistoryRowCount()).toBe(PAGE_SIZE);

    await transactionPage.clickOnPagerPage(2);

    await expect
      .poll(() => transactionPage.getHistoryRowCount())
      .toBe(TOTAL_HISTORY_ROWS - PAGE_SIZE);
  });
});
