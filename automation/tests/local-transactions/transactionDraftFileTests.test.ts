import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../utils/runtime/environment.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
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

test.describe('Transaction draft file tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify draft transaction contains the saved info for create file tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnFileCreateTransaction();

    const transactionMemoText = 'test memo';
    const fileMemoText = 'file memo';
    // const fileContent = 'test file content';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileMemo(fileMemoText);
    // await transactionPage.fillInFileContent(fileContent);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileMemoFromField = await transactionPage.getFileMemoTextFromField();
    expect(fileMemoFromField).toBe(fileMemoText);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for update file tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnUpdateFileSublink();

    const transactionMemoText = 'test memo';
    const fileMemoText = 'file memo';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileIdForUpdate(fileId ?? '');
    await transactionPage.fillInFileMemo(fileMemoText);

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileIdFromPage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileId).toBe(fileIdFromPage);

    const fileMemoFromField = await transactionPage.getFileMemoTextFromField();
    expect(fileMemoFromField).toBe(fileMemoText);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });

  test('Verify draft transaction contains the saved info for append file tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnAppendFileSublink();

    const transactionMemoText = 'test memo';

    await transactionPage.fillInTransactionMemoUpdate(transactionMemoText);
    await transactionPage.fillInFileIdForAppend(fileId ?? '');

    await transactionPage.saveDraft();
    await transactionPage.clickOnFirstDraftContinueButton();

    const transactionMemoFromField = await transactionPage.getTransactionMemoText();
    expect(transactionMemoFromField).toBe(transactionMemoText);

    const fileIdFromPage = await transactionPage.getFileIdFromAppendPage();
    expect(fileId).toBe(fileIdFromPage);

    await transactionPage.navigateToDrafts();
    await transactionPage.deleteFirstDraft();
  });
});
