import { test } from '@playwright/test';
import { flushRateLimiter } from '../../../utils/db/databaseUtil.js';
import { setDialogMockState } from '../../../utils/runtime/dialogMocks.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
  type OrganizationSuiteAppContext,
} from './organizationSuiteBootstrap.js';
import {
  setupOrganizationAdvancedFixture,
  type OrganizationAdvancedFixture,
} from '../fixtures/organizationAdvancedFixture.js';

type OrganizationSuitePages = Pick<
  OrganizationSuiteAppContext,
  'window' | 'loginPage' | 'transactionPage' | 'organizationPage'
>;

export interface RegisterOrganizationAdvancedSuiteHooksOptions {
  resolveOrganizationNickname: (testTitle: string) => string;
  onSuiteReady: (suite: OrganizationSuiteAppContext) => void;
  getPages: () => OrganizationSuitePages;
  onFixtureReady: (fixture: OrganizationAdvancedFixture) => void | Promise<void>;
  logoutFromOrganization: () => Promise<void>;
}

export function registerOrganizationAdvancedSuiteHooks({
  resolveOrganizationNickname,
  onSuiteReady,
  getPages,
  onFixtureReady,
  logoutFromOrganization,
}: RegisterOrganizationAdvancedSuiteHooksOptions): void {
  let suiteContext: OrganizationSuiteAppContext | null = null;

  test.slow();

  test.beforeAll(async () => {
    suiteContext = await setupOrganizationSuiteApp(test.info());
    onSuiteReady(suiteContext);
    suiteContext.window.on('console', msg => {
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
    const { window, loginPage, transactionPage, organizationPage } = getPages();
    await setDialogMockState(window, { savePath: null, openPaths: [] });

    const fixture = await setupOrganizationAdvancedFixture(
      window,
      loginPage,
      organizationPage,
      resolveOrganizationNickname(testInfo.title),
    );
    await onFixtureReady(fixture);
    await transactionPage.clickOnTransactionsMenuButton();

    await organizationPage.waitForElementToDisappear('.v-toast__text');
    await organizationPage.closeDraftModal();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  test.afterEach(async () => {
    try {
      await logoutFromOrganization();
    } catch {
      // Several tests delete or fully consume the current org session.
      // The next beforeEach recreates the fixture from scratch.
    }
  });

  test.afterAll(async () => {
    if (!suiteContext) {
      return;
    }

    await teardownOrganizationSuiteApp(suiteContext.app, suiteContext.isolationContext);
  });
}
