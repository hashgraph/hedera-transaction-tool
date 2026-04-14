import { expect, Page, test } from '@playwright/test';
import { OrganizationPage } from '../../pages/OrganizationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { flushRateLimiter } from '../../utils/db/databaseUtil.js';
import { signatureMapToV1Json } from '../../utils/data/transactionUtil.js';
import { waitAndReadFile } from '../../utils/files/fileWait.js';
import { setDialogMockState } from '../../utils/runtime/dialogMocks.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { waitForValidStart } from '../../utils/runtime/timing.js';
import { PrivateKey, Transaction } from '@hiero-ledger/sdk';
import * as path from 'node:path';
import * as fsp from 'fs/promises';
import JSZip from 'jszip';
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

test.describe('Organization Transaction compatibility tests @organization-advanced', () => {
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
    complexKeyAccountId = fixture.complexKeyAccountId;
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

    test.skip('Verify user can export and import transaction and a large number of signatures for TTv1->TTv2 compatibility', async () => {
      await organizationPage.createAdditionalUsers(73, globalCredentials.password);

      const newAccountId = (await organizationPage.createComplexKeyAccountForUsers(75)) ?? '';

      await transactionPage.clickOnTransactionsMenuButton();
      const { txId, validStart } = await organizationPage.createAccountWithFeePayerId(newAccountId);

      await transactionPage.clickOnExportTransactionButton('Export');

      const txBytes = await waitAndReadFile(transactionPath, 5000);
      const tx = Transaction.fromBytes(txBytes);

      const openPaths = [];
      for (let i = 1; i < 76; i++) {
        const sigJsonPath = path.join(exportDir, `sig${i}.json`);
        const sigZipPath = path.join(exportDir, `sig${i}.zip`);
        const pk = PrivateKey.fromStringED25519(organizationPage.getUser(i).privateKey);
        const sig = signatureMapToV1Json(pk.signTransaction(tx));

        const zip = new JSZip();
        zip.file(path.basename(sigJsonPath), Buffer.from(sig));
        zip.file(path.basename(transactionPath), txBytes);
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fsp.writeFile(sigZipPath, zipContent);
        openPaths.push(sigZipPath);
      }

      await setDialogMockState(window, { openPaths });
      await transactionPage.importV1Signatures();

      await waitForValidStart(validStart ?? '');

      await organizationPage.clickOnHistoryTab();
      const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
      expect(transactionDetails?.transactionId).toBe(txId);
      expect(transactionDetails?.transactionType).toBe('Account Create');
      expect(transactionDetails?.validStart).toBeTruthy();
      expect(transactionDetails?.detailsButton).toBe(true);
      expect(transactionDetails?.status).toBe('SUCCESS');
    });

    test.skip('Verify user can import superfluous signatures from TTv1 format', async () => {
      await organizationPage.createAdditionalUsers(1, globalCredentials.password);

      const { txId, validStart } =
        await organizationPage.createAccountWithFeePayerId(complexKeyAccountId);

      await transactionPage.clickOnExportTransactionButton('Export');

      const txBytes = await waitAndReadFile(transactionPath, 5000);
      const tx = Transaction.fromBytes(txBytes);

      const openPaths = [];
      for (let i = 1; i < 4; i++) {
        const sigJsonPath = path.join(exportDir, `sig${i}.json`);
        const sigZipPath = path.join(exportDir, `sig${i}.zip`);
        const pk = PrivateKey.fromStringED25519(organizationPage.getUser(i).privateKey);
        const sig = signatureMapToV1Json(pk.signTransaction(tx));

        const zip = new JSZip();
        zip.file(path.basename(sigJsonPath), Buffer.from(sig));
        zip.file(path.basename(transactionPath), txBytes);
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fsp.writeFile(sigZipPath, zipContent);
        openPaths.push(sigZipPath);
      }

      await organizationPage.clickOnSignTransactionButton();

      await setDialogMockState(window, { openPaths });
      await transactionPage.importV1Signatures();

      await waitForValidStart(validStart ?? '');

      await organizationPage.clickOnHistoryTab();
      const transactionDetails = await organizationPage.getHistoryTransactionDetails(txId ?? '');
      expect(transactionDetails?.transactionId).toBe(txId);
      expect(transactionDetails?.transactionType).toBe('Account Create');
      expect(transactionDetails?.validStart).toBeTruthy();
      expect(transactionDetails?.detailsButton).toBe(true);
      expect(transactionDetails?.status).toBe('SUCCESS');
    });

    test.skip('Verify user cannot import signatures without visibility of transaction from TTv1 format', async () => {
      await organizationPage.createAdditionalUsers(1, globalCredentials.password);

      await organizationPage.createAccountWithFeePayerId(complexKeyAccountId);

      await transactionPage.clickOnExportTransactionButton('Export');

      const txBytes = await waitAndReadFile(transactionPath, 5000);
      const tx = Transaction.fromBytes(txBytes);

      const openPaths = [];
      for (let i = 0; i < 3; i++) {
        const sigJsonPath = path.join(exportDir, `sig${i}.json`);
        const sigZipPath = path.join(exportDir, `sig${i}.zip`);
        const pk = PrivateKey.fromStringED25519(organizationPage.getUser(i).privateKey);
        const sig = signatureMapToV1Json(pk.signTransaction(tx));

        const zip = new JSZip();
        zip.file(path.basename(sigJsonPath), Buffer.from(sig));
        zip.file(path.basename(transactionPath), txBytes);
        const zipContent = await zip.generateAsync({ type: 'nodebuffer' });
        await fsp.writeFile(sigZipPath, zipContent);
        openPaths.push(sigZipPath);
      }

      await transactionPage.clickOnTransactionsMenuButton();
      await organizationPage.logoutFromOrganization();

      const fourthUser = organizationPage.getUser(3);
      await organizationPage.signInOrganization(
        fourthUser.email,
        fourthUser.password,
        globalCredentials.password,
      );

      await setDialogMockState(window, { openPaths });
      await transactionPage.clickOnTransactionsMenuButton();
      await transactionPage.clickOnImportButton();
      expect(await transactionPage.isConfirmImportButtonDisabled()).toBe(true);
      await window.keyboard.press('Escape');
    });
  });
});
