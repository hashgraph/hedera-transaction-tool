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

test.describe('Transaction file execution tests @local-transactions', () => {
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

  test('Verify all elements are present on file create tx page', async () => {
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnFileServiceLink();
    await transactionPage.clickOnFileCreateTransaction();

    const isAllElementsVisible = await transactionPage.verifyFileCreateTransactionElements();
    expect(isAllElementsVisible).toBe(true);
  });

  test('Verify user can execute file create tx', async () => {
    const { transactionId } = await transactionPage.createFile('test');

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(
      transactionId ?? '',
    );
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('FILECREATE');
    expect(result).toBe('SUCCESS');
  });

  test('Verify file is stored in the db after file create tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();

    const isExistingInDb = await transactionPage.verifyFileExists(fileId ?? '');

    expect(isExistingInDb).toBe(true);
  });

  test('Verify user can execute file read tx', async () => {
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const textFromCache = await transactionPage.getTextFromCache(fileId ?? '');

    const readContent = await transactionPage.readFile(fileId ?? '');

    expect(readContent).toBe(textFromCache);
  });

  test('Verify user can execute file update tx', async () => {
    const newText = 'Lorem Ipsum';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.updateFile(fileId ?? '', newText);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId ?? '');
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('FILEUPDATE');
    expect(result).toBe('SUCCESS');

    // Verify file content is updated.
    const readContent = await transactionPage.readFile(fileId ?? '');
    const textFromCache = await transactionPage.getTextFromCache(fileId ?? '');
    expect(readContent).toBe(textFromCache);
  });

  test('Verify user can execute file append tx', async () => {
    const newText = ' extra text to append';
    await transactionPage.ensureFileExists('test');
    const fileId = await transactionPage.getFirsFileIdFromCache();
    const transactionId = await transactionPage.appendFile(fileId ?? '', newText);

    const transactionDetails = await transactionPage.mirrorGetTransactionResponse(transactionId ?? '');
    const transactionType = transactionDetails?.name;
    const result = transactionDetails?.result;
    expect(transactionType).toBe('FILEAPPEND');
    expect(result).toBe('SUCCESS');

    // Verify file content is appended.
    const readContent = await transactionPage.readFile(fileId ?? '');
    const textFromCache = await transactionPage.getTextFromCache(fileId ?? '');
    expect(readContent).toBe(textFromCache);
  });
});
