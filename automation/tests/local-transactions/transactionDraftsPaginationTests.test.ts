import { Page, expect, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import { seedTransactionDrafts } from '../../utils/db/seedTransactionRecords.js';
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

// 4.3.3: Drafts.vue uses AppPager with default pageSize 10 from useTableQueryState.
// Seeding 11 rows ensures a second page exists. We assert page sizes rather than
// per-row text to avoid (a) substring strict-mode collisions between
// "pagination draft 1" and "pagination draft 1{0,1}", and (b) flakiness when the
// initial fetch order isn't stable (Drafts.vue uses no orderBy clause).
const TOTAL_DRAFTS = 11;
const PAGE_SIZE = 10;

test.describe('Transaction drafts pagination tests @local-transactions', () => {
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

  test('Verify drafts table paginates at 10 items per page', async () => {
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    await seedTransactionDrafts(seededUser.userId, TOTAL_DRAFTS);

    await transactionPage.navigateToDrafts();

    expect(await transactionPage.isPagerMultiPageVisible()).toBe(true);

    await expect.poll(() => transactionPage.getDraftRowCount()).toBe(PAGE_SIZE);

    await transactionPage.clickOnPagerPage(2);

    await expect
      .poll(() => transactionPage.getDraftRowCount())
      .toBe(TOTAL_DRAFTS - PAGE_SIZE);
  });
});
