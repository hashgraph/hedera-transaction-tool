import { expect, Page, test } from '@playwright/test';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import { waitAndReadFile } from '../../utils/files/fileWait.js';
import { writeMergedV1SignatureZip } from '../../utils/files/v1SignatureZip.js';
import { setDialogMockState } from '../../utils/runtime/dialogMocks.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { Transaction } from '@hiero-ledger/sdk';
import * as path from 'node:path';
import * as fsp from 'fs/promises';
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

let complexKeyAccountId: string;
const resolveOrganizationNickname = createSequentialOrganizationNicknameResolver();
const LARGE_SIGNATURE_IMPORT_ADDITIONAL_USER_COUNT = 23;
const LARGE_SIGNATURE_IMPORT_SIGNER_COUNT = 25;
const FIRST_ADDITIONAL_USER_INDEX = 1;
const SINGLE_ADDITIONAL_USER_COUNT = 1;
const SUPERFLUOUS_SIGNATURE_USER_INDEXES = [1, 2, 3] as const;
const INVISIBLE_TRANSACTION_SIGNATURE_USER_INDEXES = [0, 1, 2] as const;
const INVISIBLE_TRANSACTION_LOGIN_USER_INDEX = 3;

function getFileReadTimeout() {
  return organizationPage.getLongTimeout();
}

async function expectSuccessfulAccountCreateInHistory(
  txId: string | null,
  validStart: string | null,
) {
  const transactionDetails = await organizationPage.waitForSuccessfulHistoryTransaction(
    txId ?? '',
    validStart,
  );
  expect(transactionDetails?.transactionId).toBe(txId);
  expect(transactionDetails?.transactionType).toBe('Account Create');
  expect(transactionDetails?.validStart).toBeTruthy();
  expect(transactionDetails?.detailsButton).toBe(true);
  expect(transactionDetails?.status).toBe('SUCCESS');
}

test.describe('Organization Transaction compatibility tests @organization-advanced', () => {
  test.slow();

  test.beforeAll(async () => {
    ({ app, window, loginPage, transactionPage, organizationPage, isolationContext } =
      await setupOrganizationSuiteApp(test.info()));
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
    complexKeyAccountId = fixture.complexKeyAccountId;
    await transactionPage.clickOnTransactionsMenuButton();

    await organizationPage.waitForToastToDisappear();
    await organizationPage.closeDraftModal();
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

  test.describe('TTv1->TTv2 signature import/export compatibility', () => {
    let exportDir: string;
    let savePath: string;
    let transactionPath: string;

    test.beforeEach(async () => {
      exportDir = path.join('/tmp', 'transaction-output');
      savePath = path.join(exportDir, 'transaction.tx');
      transactionPath = path.join(exportDir, 'transaction.tx');
      await fsp.rm(exportDir, { recursive: true, force: true });
      await fsp.mkdir(exportDir, { recursive: true });

      await setDialogMockState(window, { savePath });
    });

    test.afterEach(async () => {
      if (exportDir) {
        await fsp.rm(exportDir, { recursive: true, force: true });
      }
    });

    test('Verify user can export and import transaction with 25 signatures for TTv1->TTv2 compatibility', async () => {
      await organizationPage.createAdditionalUsers(
        LARGE_SIGNATURE_IMPORT_ADDITIONAL_USER_COUNT,
        globalCredentials.password,
      );

      const newAccountId =
        (await organizationPage.createComplexKeyAccountForUsers(
          LARGE_SIGNATURE_IMPORT_SIGNER_COUNT,
        )) ?? '';

      await transactionPage.clickOnTransactionsMenuButton();
      const { txId, validStart } = await organizationPage.createAccountWithFeePayerId(newAccountId);

      await transactionPage.clickOnExportTransactionButton('Export');

      const txBytes = await waitAndReadFile(transactionPath, getFileReadTimeout());
      const tx = Transaction.fromBytes(txBytes);

      const sigZipPath = await writeMergedV1SignatureZip(
        exportDir,
        'signatures',
        tx,
        txBytes,
        Array.from(
          { length: LARGE_SIGNATURE_IMPORT_SIGNER_COUNT },
          (_, index) => organizationPage.getUser(index + FIRST_ADDITIONAL_USER_INDEX).privateKey,
        ),
        transactionPath,
      );

      await setDialogMockState(window, { openPaths: [sigZipPath] });
      await transactionPage.importV1Signatures();

      await expectSuccessfulAccountCreateInHistory(txId, validStart);
    });

    test('Verify user can import superfluous signatures from TTv1 format', async () => {
      await organizationPage.createAdditionalUsers(
        SINGLE_ADDITIONAL_USER_COUNT,
        globalCredentials.password,
      );

      const { txId, validStart } =
        await organizationPage.createAccountWithFeePayerId(complexKeyAccountId);

      await transactionPage.clickOnExportTransactionButton('Export');

      const txBytes = await waitAndReadFile(transactionPath, getFileReadTimeout());
      const tx = Transaction.fromBytes(txBytes);
      const sigZipPath = await writeMergedV1SignatureZip(
        exportDir,
        'superfluous-signatures',
        tx,
        txBytes,
        SUPERFLUOUS_SIGNATURE_USER_INDEXES.map(index => organizationPage.getUser(index).privateKey),
        transactionPath,
      );

      await organizationPage.clickOnSignTransactionButton();

      await setDialogMockState(window, { openPaths: [sigZipPath] });
      await transactionPage.importV1Signatures();

      await expectSuccessfulAccountCreateInHistory(txId, validStart);
    });

    test('Verify user cannot import signatures without visibility of transaction from TTv1 format', async () => {
      await organizationPage.createAdditionalUsers(
        SINGLE_ADDITIONAL_USER_COUNT,
        globalCredentials.password,
      );

      await organizationPage.createAccountWithFeePayerId(complexKeyAccountId);

      await transactionPage.clickOnExportTransactionButton('Export');

      const txBytes = await waitAndReadFile(transactionPath, getFileReadTimeout());
      const tx = Transaction.fromBytes(txBytes);
      const sigZipPath = await writeMergedV1SignatureZip(
        exportDir,
        'invisible-transaction-signatures',
        tx,
        txBytes,
        INVISIBLE_TRANSACTION_SIGNATURE_USER_INDEXES.map(
          index => organizationPage.getUser(index).privateKey,
        ),
        transactionPath,
      );

      await transactionPage.clickOnTransactionsMenuButton();
      await organizationPage.logoutFromOrganization();

      const fourthUser = organizationPage.getUser(INVISIBLE_TRANSACTION_LOGIN_USER_INDEX);
      await organizationPage.signInOrganization(
        fourthUser.email,
        fourthUser.password,
        globalCredentials.password,
      );

      await setDialogMockState(window, { openPaths: [sigZipPath] });
      await transactionPage.clickOnTransactionsMenuButton();
      await transactionPage.clickOnImportButton();
      expect(await transactionPage.isConfirmImportButtonDisabled()).toBe(true);
      await transactionPage.closeImportModal();
    });
  });
});
