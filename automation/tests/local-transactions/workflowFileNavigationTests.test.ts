import { expect, Page, test } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
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
import { updateLocalFileMetadata } from '../../utils/db/databaseQueries.js';
import { deleteFileFromNetwork } from '../helpers/support/fileNetworkSupport.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let registrationPage: RegistrationPage;
let transactionPage: TransactionPage;
let accountPage: AccountPage;
let filePage: FilePage;
let isolationContext: ActivatedTestIsolationContext | null = null;
let payerPrivateKeyDerHex: string | null = null;

test.describe('Workflow file navigation tests @local-transactions', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    registrationPage = new RegistrationPage(window, seededUser.recoveryPhraseWordMap);
    transactionPage = new TransactionPage(window);
    accountPage = new AccountPage(window);
    filePage = new FilePage(window);
    transactionPage.generatedAccounts = [];
    payerPrivateKeyDerHex = await setupEnvironmentForTransactions(window);
    await transactionPage.clickOnTransactionsMenuButton();

    if (process.env.CI) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await transactionPage.closeDraftModal();
  });

  test('Verify file card is visible with valid information', async () => {
    const { fileId } = await transactionPage.createFile('test');
    const createdFileId = fileId ?? '';
    expect(createdFileId).toBeTruthy();

    await accountPage.clickOnAccountsLink(); // ensure we leave tx flow before opening Files
    await filePage.clickOnFilesMenuButton();
    await expect.poll(() => filePage.isFileCardVisible(createdFileId)).toBe(true);
    await filePage.clickOnFileCardByFileId(createdFileId);

    const fileIdText = await filePage.getFileIdText();
    expect(fileIdText).toBeTruthy();

    // Content should either render inline or provide a "View" button for cached content.
    const hasInlineContent = await filePage.isDisplayedFileContentVisible();
    const hasViewButton = await filePage.isViewStoredFileButtonVisible();
    expect(hasInlineContent || hasViewButton).toBe(true);

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

    // Verify nickname and description can be edited in-place.
    const newNickname = 'My File Nickname';
    await filePage.clickOnEditSelectedFileNickname();
    await filePage.fillSelectedFileNickname(newNickname);
    await filePage.saveSelectedFileNickname();
    expect(await filePage.getSelectedFileNicknameText()).toBe(newNickname);

    const newDescription = 'My file description';
    await filePage.clickOnEditSelectedFileDescription();
    await filePage.fillSelectedFileDescription(newDescription);
    await filePage.saveSelectedFileDescription();
    expect((await filePage.getFileDescriptionText())?.trim()).toBe(newDescription);

    // 9.2.9: "File is deleted" warning shown for deleted files
    expect(payerPrivateKeyDerHex).toBeTruthy();
    const deletedFileMetaBytes = await deleteFileFromNetwork(
      createdFileId,
      payerPrivateKeyDerHex ?? '',
    );
    expect(await updateLocalFileMetadata(createdFileId, deletedFileMetaBytes)).toBe(true);
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();
    await filePage.clickOnFileCardByFileId(createdFileId);
    expect(await filePage.isFileDeletedWarningVisible()).toBe(true);
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
    const nickname = 'Linked File';
    const description = 'Linked file description';
    await filePage.fillInExistingFileNickname(nickname);
    await filePage.fillInExistingFileDescription(description);
    expect(await filePage.isLinkFileButtonDisabled()).toBe(false);
    await filePage.clickOnLinkFileButton();
    await accountPage.clickOnAccountsLink();
    await filePage.clickOnFilesMenuButton();

    const isFileCardVisible = await filePage.isFileCardVisible(fileFromList);
    expect(isFileCardVisible).toBe(true);

    await filePage.clickOnFileCardByFileId(fileFromList);
    expect(await filePage.getSelectedFileNicknameText()).toBe(nickname);
    expect((await filePage.getFileDescriptionText())?.trim()).toBe(description);
  });

  test('Verify duplicate file link shows error toast', async () => {
    await transactionPage.ensureFileExists('test');
    await filePage.clickOnFilesMenuButton();
    const fileFromPage = (await filePage.getFirstFileIdFromPage()) ?? '';
    await filePage.clickOnAddNewButtonForFile();
    await filePage.clickOnAddExistingFileLink();
    await filePage.fillInExistingFileId(fileFromPage);
    await filePage.clickOnLinkFileButton();
    const toastText = await registrationPage.getToastMessageByVariant('error');
    expect(toastText).toContain('File ID or Nickname already exists!');
  });
});
