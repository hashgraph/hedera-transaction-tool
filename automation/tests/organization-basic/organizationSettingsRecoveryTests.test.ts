import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { OrganizationPage, UserDetails } from '../../pages/OrganizationPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import { generateRandomPassword } from '../../utils/data/random.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededOrganizationSession } from '../../utils/seeding/organizationSeeding.js';
import {
  setupOrganizationSuiteApp,
  teardownOrganizationSuiteApp,
} from '../helpers/bootstrap/organizationSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { createSequentialOrganizationNicknameResolver } from '../helpers/support/organizationNamingSupport.js';
import { setupOrganizationSettingsGeneralSuite } from '../helpers/fixtures/organizationSettingsGeneralSuite.js';
import { generateEd25519KeyPair } from '../../utils/crypto/keyUtil.js';
import { deleteKeyPairByPublicKey } from '../../utils/db/localQueries.js';

let app: TransactionToolApp;
let window: Page;
let globalCredentials = { email: '', password: '' };

let loginPage: LoginPage;
let organizationPage: OrganizationPage;
let settingsPage: SettingsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let organizationNickname = 'Test Organization';

let firstUser: UserDetails;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();

test.describe('Organization Settings (Recovery) tests @organization-basic', () => {
  test.slow();
  test.beforeAll(async () => {
    ({
      app,
      window,
      loginPage,
      organizationPage,
      isolationContext,
    } = await setupOrganizationSuiteApp(test.info()));
    settingsPage = new SettingsPage(window);
  });

  test.beforeEach(async ({}, testInfo) => {
    organizationNickname = resolveOrganizationNickname(testInfo.title);
    const seededSession = await createSeededOrganizationSession(
      window,
      loginPage,
      organizationPage,
      {
        userCount: 1,
        organizationNickname,
      },
    );
    globalCredentials.email = seededSession.localUser.email;
    globalCredentials.password = seededSession.localUser.password;
    firstUser = organizationPage.getUser(0);
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

  test('Verify user is prompted for mnemonic phrase and can recover account when resetting organization', async () => {
    const visibleToasts = window.locator('.v-toast__text:visible');
    const waitForToastText = async (text: string) => {
      await expect
        .poll(
          async () => {
            const texts = await visibleToasts.allTextContents();
            return texts.map(value => value.trim()).includes(text);
          },
          {
            timeout: organizationPage.getLongTimeout(),
          },
        )
        .toBe(true);
    };

    // Seeded org users already have backend mnemonic hashes.
    // Clear them for this test to enforce the recovery flow after reset.
    await organizationPage.clearUserKeyMnemonicHashesByEmail(firstUser.email);

    await organizationPage.selectPersonalMode();
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await loginPage.waitForToastToDisappear();
    await organizationPage.clickOnDeleteFirstOrganization();
    await waitForToastText('Connection deleted successfully');

    await organizationPage.setupOrganization(organizationNickname);
    await waitForToastText('Organization Added');

    await organizationPage.fillInLoginDetailsAndClickSignIn(firstUser.email, firstUser.password);
    await organizationPage.recoverAccount(0);
    const isContactListVisible = await organizationPage.isContactListButtonVisible();
    expect(isContactListVisible).toBe(true);
  });

  test('Verify additional keys are saved when user restores his account', async () => {
    // Ensure reset flow requires mnemonic recovery for this organization user.
    await organizationPage.clearUserKeyMnemonicHashesByEmail(firstUser.email);

    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.clickOnDeleteFirstOrganization();
    await organizationPage.setupOrganization(organizationNickname);
    await organizationPage.fillInLoginDetailsAndClickSignIn(firstUser.email, firstUser.password);
    await organizationPage.recoverAccount(0);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    const keyRestoreButtonCount = await organizationPage.countKeyRestoreButtons();
    expect(keyRestoreButtonCount).toBe(1);
    await organizationPage.recoverPrivateKey(window);
  });

  test('Verify user can restore missing keys when doing account recovery', async () => {
    // Ensure reset flow requires mnemonic recovery for this organization user.
    await organizationPage.clearUserKeyMnemonicHashesByEmail(firstUser.email);

    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.clickOnDeleteFirstOrganization();
    await organizationPage.setupOrganization(organizationNickname);
    await organizationPage.fillInLoginDetailsAndClickSignIn(firstUser.email, firstUser.password);
    await organizationPage.recoverAccount(0);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await organizationPage.recoverPrivateKey(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    const restoreButtonCount = await organizationPage.countKeyRestoreButtons();
    const uploadButtonCount = await organizationPage.countKeyUploadButtons();
    expect(restoreButtonCount + uploadButtonCount).toBe(0);
  });

  test('Verify organization user can change password', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnProfileTab();

    await settingsPage.fillInCurrentPassword(firstUser.password);
    const newPassword = generateRandomPassword();
    await settingsPage.fillInNewPassword(newPassword);
    await settingsPage.clickOnChangePasswordButton();
    await settingsPage.clickOnConfirmChangePassword();
    if (await organizationPage.isEncryptPasswordInputVisible()) {
      await organizationPage.fillOrganizationEncryptionPasswordAndContinue(
        globalCredentials.password,
      );
    }
    await settingsPage.clickOnCloseButton();
    organizationPage.changeUserPassword(firstUser.email, newPassword);
    await organizationPage.logoutFromOrganization();
    await organizationPage.signInOrganization(
      firstUser.email,
      firstUser.password,
      globalCredentials.password,
    );

    // verify that the settings button is visible(indicating he's logged in successfully in the app)
    const isButtonVisible = await loginPage.isSettingsButtonVisible();
    expect(isButtonVisible).toBe(true);
  });

  test('Verify organization login form is visible after logout', async () => {
    await organizationPage.logoutFromOrganization();
    const isLoginFormVisible = await organizationPage.isOrganizationLoginFormVisible();
    expect(isLoginFormVisible).toBe(true);
  });

  test('Verify user can restore account with new mnemonic phrase', async () => {
    const publicKeyBeforeReset = await organizationPage.getFirstPublicKeyByEmail(firstUser.email);
    const userId = await organizationPage.getUserIdByEmail(firstUser.email);
    await organizationPage.clearUserKeyMnemonicHashesByEmail(firstUser.email);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnOrganisationsTab();
    await organizationPage.clickOnDeleteFirstOrganization();
    await organizationPage.setupOrganization(organizationNickname);
    await organizationPage.fillInLoginDetailsAndClickSignIn(firstUser.email, firstUser.password);
    organizationPage.generateAndSetRecoveryWords();
    await organizationPage.recoverAccount(0);

    //verify old mnemonic is still present in the db
    const isKeyDeleted = await organizationPage.isKeyDeleted(publicKeyBeforeReset);
    expect(isKeyDeleted).toBe(false);

    const isNewKeyAddedInDb = await organizationPage.findNewKey(userId);
    expect(isNewKeyAddedInDb).toBe(true);
  });
});

test.describe('Settings keys missing-key import tests', () => {
  const suite = setupOrganizationSettingsGeneralSuite();

  test('Verify user can import an external private key for a missing key', async () => {
    // Importing an external key in organization mode creates an organization
    // user_key without a recovery-phrase index.
    const { privateKey } = generateEd25519KeyPair();
    const externalKeyNickname = 'External-missing-key';

    await suite.settingsPage.clickOnSettingsButton();
    await suite.settingsPage.clickOnKeysTab();
    const baselineRowCount = await suite.settingsPage.getKeyRowCount();
    await suite.settingsPage.clickOnImportButton();
    await suite.settingsPage.clickOnED25519DropDown();
    await suite.settingsPage.importED25519PrivateKey(privateKey, externalKeyNickname);
    await suite.registrationPage.waitForToastMessageByVariant(
      'success',
      'ED25519 private key imported successfully',
    );

    const importedRowCount = await suite.settingsPage.getKeyRowCount();
    expect(importedRowCount).toBe(baselineRowCount + 1);
    const importedRows = await Promise.all(
      Array.from({ length: importedRowCount }, (_, index) =>
        suite.settingsPage.getRowDataByIndex(index),
      ),
    );
    const importedRowIndex = importedRows.findIndex(
      row => row.nickname?.trim() === externalKeyNickname,
    );
    expect(importedRowIndex).toBeGreaterThanOrEqual(0);
    const publicKey = importedRows[importedRowIndex].publicKey?.trim() ?? '';
    expect(publicKey).toBeTruthy();

    // Organization-scoped local keys are hidden in personal mode, and the
    // organization-mode delete action also deletes the remote user_key. Remove
    // only the local copy so the remote key remains available for restoration.
    expect(await deleteKeyPairByPublicKey(publicKey)).toBe(true);
    await suite.organizationPage.selectPersonalMode();
    await suite.organizationPage.selectOrganizationMode();
    await suite.settingsPage.clickOnSettingsButton();
    await suite.settingsPage.clickOnKeysTab();
    await suite.settingsPage.clickOnRestoreKeyButtonForPublicKey(publicKey);
    await suite.settingsPage.importED25519PrivateKey(privateKey, 'Recovered-external-key');

    await suite.registrationPage.waitForToastMessageByVariant(
      'success',
      'ED25519 private key imported successfully',
    );
    const rowCount = await suite.settingsPage.getKeyRowCount();
    expect(rowCount).toBe(baselineRowCount + 1);

    const rows = await Promise.all(
      Array.from({ length: rowCount }, (_, index) => suite.settingsPage.getRowDataByIndex(index)),
    );
    expect(rows.some(row => row.publicKey?.trim() === publicKey)).toBe(true);
  });
});
