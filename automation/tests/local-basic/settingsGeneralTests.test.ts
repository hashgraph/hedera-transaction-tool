import { Page, expect, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { PrivateKey } from '@hiero-ledger/sdk';
import { LoginPage } from '../../pages/LoginPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';

let app: TransactionToolApp;
let window: Page;
const globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let settingsPage: SettingsPage;
let transactionPage: TransactionPage;
let registrationPage: RegistrationPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Settings general tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    settingsPage = new SettingsPage(window);
    transactionPage = new TransactionPage(window);
    registrationPage = new RegistrationPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    globalCredentials.email = seededUser.email;
    globalCredentials.password = seededUser.password;
    await settingsPage.clickOnSettingsButton();
  });

  test('Verify that all elements in settings page are present', async () => {
    const allElementsVisible = await settingsPage.verifySettingsElements();
    expect(allElementsVisible).toBe(true);
  });

  test('Verify user can switch between Dark and Light themes', async () => {
    await settingsPage.clickOnDarkThemeTab();
    expect(await settingsPage.isDarkThemeTabActive()).toBe(true);

    await settingsPage.clickOnLightThemeTab();
    expect(await settingsPage.isLightThemeTabActive()).toBe(true);
  });

  test('Verify user can switch to Custom and enter mirror node base URL', async () => {
    const customMirrorNodeBaseURL = 'https://mainnet-public.mirrornode.hedera.com:443/';

    await settingsPage.clickOnCustomNodeTab();
    expect(await settingsPage.isCustomNodeTabActive()).toBe(true);
    expect(await settingsPage.isMirrorNodeBaseURLInputVisible()).toBe(true);

    await settingsPage.fillInMirrorNodeBaseURL(customMirrorNodeBaseURL);
    await settingsPage.applyMirrorNodeBaseURL();

    const mirrorNodeBaseURL = await settingsPage.getMirrorNodeBaseURL();
    expect(mirrorNodeBaseURL).toBe('mainnet-public.mirrornode.hedera.com');
  });

  test('Verify user can set global max tx fee', async () => {
    const maxTransactionFee = '5';
    await settingsPage.fillInDefaultMaxTransactionFee(maxTransactionFee);

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const transactionFee = await transactionPage.getMaxTransactionFee();
    expect(transactionFee).toBe(maxTransactionFee);
  });

  test('Verify organizations empty state and invalid server URL validation', async () => {
    await settingsPage.clickOnOrganisationsTab();
    expect(await settingsPage.isOrganizationsEmptyStateVisible()).toBe(true);

    await settingsPage.clickOnConnectOrganizationButton();
    await settingsPage.fillInAddOrganizationServerUrl('not-a-url');
    await settingsPage.clickOnAddOrganizationInModalButton();

    await registrationPage.waitForToastMessageByVariant('error', 'Invalid Server URL');
  });

  test('Verify user can manage public key mappings (import, rename, copy, delete)', async () => {
    await settingsPage.clickOnPublicKeysTab();

    // Table headers
    const headerText = await settingsPage.getPublicKeysTableHeaderText();
    expect(headerText).toContain('Nickname');
    expect(headerText).toContain('Owner');
    expect(headerText).toContain('Public Key');

    // Import modal and disabled state
    await settingsPage.openImportSinglePublicKeyModal();
    expect(await settingsPage.isImportPublicKeyButtonDisabled()).toBe(true);

    // Invalid key shows error
    await settingsPage.fillInImportPublicKeyForm('invalid-key', 'Bad Key');
    expect(await settingsPage.isImportPublicKeyButtonEnabled()).toBe(true);
    await settingsPage.clickOnImportPublicKeyButton();
    await registrationPage.waitForToastMessageByVariant('error', 'Invalid public key!');

    // Import 2 valid mappings (for bulk delete)
    const key1 = PrivateKey.generateED25519().publicKey.toString();
    const key2 = PrivateKey.generateED25519().publicKey.toString();

    await settingsPage.fillInImportPublicKeyForm(key1, 'Key One');
    await settingsPage.clickOnImportPublicKeyButton();
    await registrationPage.waitForToastMessageByVariant(
      'success',
      'Public key and nickname imported successfully',
    );

    await settingsPage.openImportSinglePublicKeyModal();
    await settingsPage.fillInImportPublicKeyForm(key2, 'Key Two');
    await settingsPage.clickOnImportPublicKeyButton();
    await registrationPage.waitForToastMessageByVariant(
      'success',
      'Public key and nickname imported successfully',
    );

    // Copy public key shows success toast
    await settingsPage.clickOnCopyPublicKeyMappingAtIndex(0);
    await registrationPage.waitForToastMessageByVariant(
      'success',
      'Public Key copied successfully',
    );

    // Rename the first mapping
    await settingsPage.renamePublicKeyMappingAtIndex(0, 'Key One Renamed');
    await registrationPage.waitForToastMessageByVariant('success', 'Nickname updated successfully');
    expect(await settingsPage.getPublicKeyMappingNicknameAtIndex(0)).toContain('Key One Renamed');

    // Delete a single mapping via the row trash button
    await settingsPage.clickOnDeletePublicKeyMappingAtIndex(1);
    await settingsPage.confirmDeletePublicKeyMapping();
    await registrationPage.waitForToastMessageByVariant(
      'success',
      'Public key mapping(s) deleted successfully',
    );

    // Bulk delete remaining via select-all
    await settingsPage.clickOnSelectAllPublicKeys();
    await settingsPage.clickOnDeleteAllPublicKeys();
    await settingsPage.confirmDeletePublicKeyMapping();
    await registrationPage.waitForToastMessageByVariant(
      'success',
      'Public key mapping(s) deleted successfully',
    );
  });
});
