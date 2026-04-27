import { expect, Page, test } from '@playwright/test';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededOrganizationSession } from '../../utils/seeding/organizationSeeding.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';

let app: TransactionToolApp;
let window: Page;

let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let organizationPage: OrganizationPage;
let settingsPage: SettingsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';
let updatedOrganizationNickname = 'New Organization';
let invalidOrganizationNickname = 'Bad Organization';

const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Settings (General) tests @organization-basic', () => {
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
    settingsPage = new SettingsPage(window);
    registrationPage = new RegistrationPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    updatedOrganizationNickname = organizationNickname.replace(
      'Test Organization',
      'Updated Organization',
    );
    invalidOrganizationNickname = organizationNickname.replace(
      'Test Organization',
      'Invalid Organization',
    );

    await createSeededOrganizationSession(
      window,
      loginPage,
      organizationPage,
      {
        userCount: 1,
        organizationNickname,
      },
    );
  });

  test.afterEach(async () => {
    try {
      await organizationPage.logoutFromOrganization();
    } catch {
      // Tests can end in personal mode or after deleting the organization.
      // The next beforeEach recreates the full fixture.
    }
  });

  test.afterAll(async () => {
    await teardownOrganizationSuiteApp(app, isolationContext);
  });

  test('Verify user can switch between personal and organization mode', async () => {
    await organizationPage.selectPersonalMode();
    const isContactListHidden = await organizationPage.isContactListButtonHidden();
    expect(isContactListHidden).toBe(true);
    await organizationPage.selectOrganizationMode();
    const isContactListVisibleAfterSwitch = await organizationPage.isContactListButtonVisible();
    expect(isContactListVisibleAfterSwitch).toBe(true);
  });

  test('Verify user can edit organization nickname', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.editOrganizationNickname(updatedOrganizationNickname);
    const orgName = await organizationPage.getOrganizationNicknameText();
    expect(orgName).toBe(updatedOrganizationNickname);
    await organizationPage.editOrganizationNickname(organizationNickname);
  });

  test('Verify error message when user adds non-existing organization', async () => {
    await loginPage.waitForToastToDisappear();
    await organizationPage.setupWrongOrganization(invalidOrganizationNickname);
    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Organization does not exist. Please check the server URL');
    await organizationPage.clickOnCancelAddingOrganizationButton();
    await loginPage.waitForToastToDisappear();
  });

  test('Verify that tabs on Transaction page are visible', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    expect(await organizationPage.returnAllTabsVisible()).toBe(true);
  });

  test('Verify user can delete an organization', async () => {
    await organizationPage.selectPersonalMode();
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await loginPage.waitForToastToDisappear();
    await organizationPage.clickOnDeleteFirstOrganization();
    const visibleToasts = window.locator(registrationPage.visibleToastMessageSelector);
    await expect
      .poll(
        async () => {
          const toastTexts = await visibleToasts.allTextContents();
          return toastTexts
            .map(toast => toast.trim())
            .includes('Connection deleted successfully');
        },
        {
          timeout: registrationPage.getLongTimeout(),
        },
      )
      .toBe(true);
    const orgName = (await organizationPage.getOrganizationNicknameText()) ?? '';
    const isDeletedFromDb = await organizationPage.verifyOrganizationExists(orgName);
    expect(isDeletedFromDb).toBe(false);
  });

  test('Verify that deleting all keys prevent to sign and execute a draft transaction', async () => {
    // This test is a copy of transactionTests.test.ts 'Verify that deleting all keys prevent to sign and execute a draft transaction'
    // If you fix something here, you probably want to do the same in transactionTests.test.ts

    // Go to Settings / Keys and delete all keys
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnSelectAllKeys();
    await settingsPage.clickOnDeleteKeyAllButton();
    await settingsPage.clickOnDeleteKeyPairButton();

    // Go to Transactions and fill a new Account Update transaction
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnUpdateAccountTransaction();
    await new Promise(resolve => setTimeout(resolve, 2000));
    await transactionPage.fillInPayerAccountId('0.0.1002');
    await transactionPage.fillInMaxAutoAssociations('0'); // Workaround for -1 bug in maxAutoAssociations
    await transactionPage.fillInUpdatedAccountId('0.0.1002'); // Called last because it waits for sign and submit activation

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickOnSaveGotoSettings();
    await settingsPage.verifySettingsElements();

    // Go back to Transactions / Drafs
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnDraftsMenuButton();

    // Click Continue to edit draft transaction
    await transactionPage.clickOnFirstDraftContinueButton();

    // Click Sign and Execute, Save and Goto Settings and check Settings tab is displayed
    await new Promise(resolve => setTimeout(resolve, transactionPage.getShortTimeout()));
    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickOnGotoSettings();
    await settingsPage.verifySettingsElements();
  });
});
