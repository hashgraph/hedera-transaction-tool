import { expect, Page, test } from '@playwright/test';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import { setDialogMockState } from '../../utils/runtime/dialogMocks.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupOrganizationAdvancedFixture } from '../helpers/fixtures/organizationAdvancedFixture.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';

let app: TransactionToolApp;
let window: Page;
let globalCredentials = { email: '', password: '' };

let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let loginPage: LoginPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Transaction observer/visibility tests @organization-advanced', () => {
  test.slow();

  test.beforeAll(async () => {
    ({
      app,
      window,
      loginPage,
      transactionPage,
      organizationPage,
      isolationContext,
    } = await setupOrganizationSuiteApp(test.info()));
    window.on('console', msg => {
      const text = msg.text();
      if (
        text.includes('[TXD-DBG]') ||
        text.includes('[SIG-AUDIT-DBG]') ||
        text.includes('[ORG-USER-DBG]')
      ) {
        console.log('[BROWSER]', text);
      }
    });
  });

  test.beforeEach(async ({}, testInfo) => {
    await flushRateLimiter();
    await setDialogMockState(window, { savePath: null, openPaths: [] });

    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const fixture = await setupOrganizationAdvancedFixture(
      window,
      loginPage,
      organizationPage,
      organizationNickname,
    );
    globalCredentials.email = fixture.localCredentials.email;
    globalCredentials.password = fixture.localCredentials.password;
    await transactionPage.clickOnTransactionsMenuButton();

    await organizationPage.waitForElementToDisappear('.v-toast__text');
    await organizationPage.closeDraftModal();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Several tests delete or fully consume the current org session.
      // The next beforeEach recreates the fixture from scratch.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify transaction is not visible if user is not an observer', async () => {
    const { txId } = await organizationPage.createAccount();
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    const secondUser = organizationPage.getUser(1);
    await organizationPage.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleInProgress(
      txId ?? '',
      5,
    );
    expect(isTransactionVisible).toBe(false);
  });

  test.skip('Verify observer is listed in the transaction details', async () => {
    const { selectedObservers } = await organizationPage.createAccount(60, 1);
    const firstObserver = await organizationPage.getObserverEmail(0);
    expect(selectedObservers).toBe(firstObserver);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test('Verify transaction is visible for an observer while transaction is "In progress"', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(1000, 1, false);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    expect(typeof selectedObservers).toBe('string');
    await organizationPage.signInOrganization(
      selectedObservers as string,
      organizationPage.getUserPasswordByEmail(selectedObservers as string),
      globalCredentials.password,
    );

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnInProgressTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleInProgress(
      txId ?? '',
    );
    expect(isTransactionVisible).toBe(true);
  });

  test.skip('Verify transaction is visible for an observer while transaction is "Ready for execution"', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(1000, 1, true);
    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.logoutFromOrganization();

    expect(typeof selectedObservers).toBe('string');
    await organizationPage.signInOrganization(
      selectedObservers as string,
      organizationPage.getUserPasswordByEmail(selectedObservers as string),
      globalCredentials.password,
    );

    await transactionPage.clickOnTransactionsMenuButton();
    await organizationPage.clickOnReadyForExecutionTab();
    const isTransactionVisible = await organizationPage.isTransactionIdVisibleReadyForExecution(
      txId ?? '',
    );
    expect(isTransactionVisible).toBe(true);
  });

  test.skip('Verify observer is saved in the db for the correct transaction id', async () => {
    const { txId, selectedObservers } = await organizationPage.createAccount(1000, 1);
    expect(typeof selectedObservers).toBe('string');
    const userIdInDb = await organizationPage.getUserIdByEmail(selectedObservers as string);
    const txIdForObserver = await organizationPage.getAllTransactionIdsForUserObserver(userIdInDb);
    expect(txIdForObserver).toContain(txId);
    await transactionPage.clickOnTransactionsMenuButton();
  });

  test('Verify user can add multiple observers', async () => {
    const { selectedObservers } = await organizationPage.createAccount(60, 2, false);
    const firstObserver = await organizationPage.getObserverEmail(0);
    const secondObserver = await organizationPage.getObserverEmail(1);
    expect(selectedObservers?.length).toBeGreaterThan(1);
    expect(selectedObservers?.[0]).toBe(firstObserver);
    expect(selectedObservers?.[1]).toBe(secondObserver);
    await transactionPage.clickOnTransactionsMenuButton();
  });
});
