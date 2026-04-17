import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { setupEnvironmentForTransactions } from '../../utils/runtime/environment.js';
import { AccountPage } from '../../pages/AccountPage.js';
import { FilePage } from '../../pages/FilePage.js';
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
let accountPage: AccountPage;
let filePage: FilePage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Workflow file navigation tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    accountPage = new AccountPage(window);
    filePage = new FilePage(window);
    await createSeededLocalUserSession(window, loginPage);
    transactionPage.generatedAccounts = [];
    await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify file card is visible with valid information', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();

    const fileId = await filePage.getFileIdText();
    expect(fileId).toBeTruthy();

    const fileSize = await filePage.getFileSizeText();
    expect(fileSize).toBeTruthy();

    const fileKey = await filePage.getFileKeyText();
    expect(fileKey).toBeTruthy();

    const fileKeyType = await filePage.getFileKeyTypeText();
    expect(fileKeyType).toBeTruthy();

    const fileMemo = await filePage.getFileMemoText();
    expect(fileMemo).toBeTruthy();

    const fileLedger = await filePage.getFileLedgerText();
    expect(fileLedger).toBeTruthy();

    const fileExpiration = await filePage.getFileExpirationText();
    expect(fileExpiration).toBeTruthy();

    const fileDescription = await filePage.getFileDescriptionText();
    expect(fileDescription).toBeTruthy();
  });

  test('Verify file card update flow leads to update page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnUpdateFileButton();
    const fileIdFromUpdatePage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileId).toBe(fileIdFromUpdatePage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Update Transaction');
  });

  test('Verify file card append flow leads to append page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnAppendFileButton();
    const fileIdFromAppendPage = await transactionPage.getFileIdFromAppendPage();
    expect(fileId).toBe(fileIdFromAppendPage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Append Transaction');
  });

  test('Verify file card read flow leads to read page with prefilled fileid', async () => {
    await transactionPage.ensureFileExists('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    const fileId = await filePage.getFirstFileIdFromPage();

    await filePage.clickOnReadFileButton();
    const fileIdFromAppendPage = await transactionPage.getFileIdFromReadPage();
    expect(fileId).toBe(fileIdFromAppendPage);

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Read File Query');
  });

  test('Verify clicking on "Add new" and "Create new" navigates the user to create new file transaction page', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnCreateNewFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Create Transaction');
  });

  test('Verify clicking on "Add new" and "Update" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnUpdateFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Update Transaction');

    const fileIdFromUpdatePage = await transactionPage.getFileIdFromUpdatePage();
    expect(fileIdFromUpdatePage).toBe('');
  });

  test('Verify clicking on "Add new" and "Append" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnAppendFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('File Append Transaction');

    const fileIdFromUpdatePage = await transactionPage.getFileIdFromAppendPage();
    expect(fileIdFromUpdatePage).toBe('');
  });

  test('Verify clicking on "Add new" and "Read" navigates the user to update file transaction page w/o prefilled id', async () => {
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewFileButton();
    await filePage.clickOnReadFileLink();

    const transactionHeaderText = await transactionPage.getTransactionTypeHeaderText();
    expect(transactionHeaderText).toBe('Read File Query');

    const fileIdFromUpdatePage = await transactionPage.getFileIdFromReadPage();
    expect(fileIdFromUpdatePage).toBe('');
  });

  test('Verify user can unlink multiple files', async () => {
    await transactionPage.ensureFileExists('test');
    await filePage.clickOnFilesMenuButton();
    const fileFromPage = (await filePage.getFirstFileIdFromPage()) ?? '';
    const { fileId } = await transactionPage.createFile('test');
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnSelectManyFilesButton();
    await filePage.clickOnFileCheckbox(fileFromPage);
    await filePage.clickOnFileCheckbox(fileId ?? '');
    await filePage.clickOnRemoveMultipleButton();
    await filePage.clickOnConfirmUnlinkFileButton();

    await filePage.addFileToUnliked(fileFromPage);
    await filePage.addFileToUnliked(fileId ?? '');
    await loginPage.waitForToastToDisappear();

    const isFileCardHidden = await filePage.isFileCardHidden(fileId ?? '');
    expect(isFileCardHidden).toBe(true);

    const isSecondFileCardHidden = await filePage.isFileCardHidden(fileFromPage);
    expect(isSecondFileCardHidden).toBe(true);
  });

  test('Verify user can add an existing file to files card', async () => {
    await filePage.ensureFileExistsAndUnlinked();
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnAddNewButtonForFile();
    await filePage.clickOnAddExistingFileLink();
    const fileFromList = await filePage.getFirstFileFromList();
    await filePage.fillInExistingFileId(fileFromList);
    await filePage.clickOnLinkFileButton();
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();

    const isFileCardVisible = await filePage.isFileCardVisible(fileFromList);
    expect(isFileCardVisible).toBe(true);
  });
});
