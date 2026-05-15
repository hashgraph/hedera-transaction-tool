import { Page, expect, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let seededPublicKey: string;

const VALID_PAYER_ID = '0.0.2';
const NON_RESOLVABLE_PAYER_ID = '0.0.999999999';
const VALID_FILE_ID = '0.0.150';
const INVALID_FILE_ID = 'not-a-file-id';
const INVALID_FILE_ID_TOAST = 'Invalid File ID';

test.describe('Transaction file ID validation tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);
    transactionPage = new TransactionPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    seededPublicKey = seededUser.publicKey;
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
  });

  // 5.8.6 + 14.5.2: Invalid File ID toast on submit (File Update form).
  test('Verify File Update shows Invalid File ID error when file ID is malformed', async () => {
    await transactionPage.openFileUpdateForm();
    await transactionPage.fillInPayerAccountId(VALID_PAYER_ID);
    await transactionPage.fillInFileIdForUpdate(INVALID_FILE_ID);
    await transactionPage.fillInCurrentPublicKeyForFile(seededPublicKey);
    await transactionPage.clickOnSignAndSubmitButton();
    await registrationPage.waitForToastMessageByVariant('error', INVALID_FILE_ID_TOAST);
  });

  // 5.8.7: Sign disabled in personal mode when no signature key is set (File Update form).
  test('Verify File Update Sign button is disabled when signature key is not set', async () => {
    await transactionPage.openFileUpdateForm();
    await transactionPage.fillInPayerAccountId(VALID_PAYER_ID);
    await transactionPage.fillInFileIdForUpdate(VALID_FILE_ID);
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  // 5.9.6: Invalid File ID toast on submit (File Append form).
  test('Verify File Append shows Invalid File ID error when file ID is malformed', async () => {
    await transactionPage.openFileAppendForm();
    await transactionPage.fillInPayerAccountId(VALID_PAYER_ID);
    await transactionPage.fillInFileIdForAppend(INVALID_FILE_ID);
    await transactionPage.fillInPublicKeyForFile(seededPublicKey);
    await transactionPage.clickOnSignAndSubmitButton();
    await registrationPage.waitForToastMessageByVariant('error', INVALID_FILE_ID_TOAST);
  });

  // 5.9.7: Sign disabled in personal mode when no signature key is set (File Append form).
  test('Verify File Append Sign button is disabled when signature key is not set', async () => {
    await transactionPage.openFileAppendForm();
    await transactionPage.fillInPayerAccountId(VALID_PAYER_ID);
    await transactionPage.fillInFileIdForAppend(VALID_FILE_ID);
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });

  // 5.7.7: File Create Sign disabled when owner key is not set.
  // The form auto-fills `data.ownerKey` from the payer's resolved mirror-node key; using a
  // non-resolvable payer ensures ownerKey stays null and Sign stays disabled.
  test('Verify File Create Sign button is disabled when owner key is not set', async () => {
    await transactionPage.openFileCreateForm();
    await transactionPage.fillInPayerAccountId(NON_RESOLVABLE_PAYER_ID);
    expect(await transactionPage.isSignAndSubmitButtonEnabled()).toBe(false);
  });
});
