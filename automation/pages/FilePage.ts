import { BasePage } from './BasePage.js';
import { TransactionPage } from './TransactionPage.js';
import { Page } from '@playwright/test';

export class FilePage extends BasePage {
  // Buttons
  removeFileCardButtonSelector = 'button-remove-file-card';
  removeMultipleButtonSelector = 'button-remove-multiple-files';
  updateFileButtonSelector = 'button-update-file';
  /* Selectors */
  appendFileButtonSelector = 'button-append-file';
  readFileButtonSelector = 'button-read-file';
  addNewButtonSelector = 'button-add-new-file';
  addExistingLinkSelector = 'link-add-existing-file';
  linkFileButtonSelector = 'button-link-file';
  confirmUnlinkFileButtonSelector = 'button-confirm-unlink-file';
  filesMenuButtonSelector = 'button-menu-files';
  selectManyFilesButtonSelector = 'button-select-many-files';
  editNicknameButtonSelector = 'span-edit-file-nickname';
  editDescriptionButtonSelector = 'span-edit-file-description';
  fileNicknameInputSelector = 'input-file-nickname';
  fileDescriptionTextareaSelector = 'textarea-file-description';
  visibleFileLastViewedSelector = 'css=[data-testid="p-file-last-viewed"]:visible';
  visibleViewStoredFileButtonSelector = 'css=[data-testid="button-view-stored-file"]:visible';
  visibleDisplayedFileContentTextareaSelector = 'css=[data-testid="textarea-file-content"]:visible';
  selectedFileNicknameSelector = 'p-file-selected-nickname';
  // Inputs
  existingFileIdInputSelector = 'input-existing-file-id';
  existingFileNicknameInputSelector = 'input-existing-file-nickname';
  existingFileDescriptionTextareaSelector = 'textarea-existing-file-description';
  multiSelectFileCheckboxSelector = 'checkbox-multiple-file-id-';
  // Texts
  fileIdTextSelector = 'p-file-id-info';
  fileSizeTextSelector = 'p-file-size';
  fileKeyTextSelector = 'p-file-key';
  fileKeyTypeTextSelector = 'p-file-key-type';
  fileMemoTextSelector = 'p-file-memo';
  fileLedgerTextSelector = 'p-file-ledger-id';
  fileExpirationTextSelector = 'p-file-expires-at';
  fileDescriptionTextSelector = 'p-file-description';
  fileDeletedWarningSelector = 'p-file-is-deleted';
  fileIdListPrefixSelector = 'p-file-id-';
  toastMessageSelector = 'css=.v-toast__text';
  private readonly unlikedFiles: string[];
  private transactionPage: TransactionPage;

  constructor(window: Page) {
    super(window);
    this.unlikedFiles = [];
    this.transactionPage = new TransactionPage(window);
  }

  async clickOnRemoveFileCardButton() {
    await this.click(this.removeFileCardButtonSelector);
  }

  async clickOnRemoveMultipleButton() {
    await this.click(this.removeMultipleButtonSelector);
  }

  async clickOnEditSelectedFileNickname() {
    await this.click(this.editNicknameButtonSelector);
  }

  async fillSelectedFileNickname(nickname: string) {
    await this.fill(this.fileNicknameInputSelector, nickname);
  }

  async saveSelectedFileNickname() {
    await this.pressKey('Tab');
  }

  async getSelectedFileNicknameText() {
    return await this.getText(this.selectedFileNicknameSelector);
  }

  async clickOnEditSelectedFileDescription() {
    await this.click(this.editDescriptionButtonSelector);
  }

  async fillSelectedFileDescription(description: string) {
    await this.fill(this.fileDescriptionTextareaSelector, description);
  }

  async saveSelectedFileDescription() {
    await this.pressKey('Tab');
  }

  async getLastViewedText() {
    return await this.getText(this.visibleFileLastViewedSelector, null, this.LONG_TIMEOUT);
  }

  async isViewStoredFileButtonVisible() {
    return await this.isElementVisible(
      this.visibleViewStoredFileButtonSelector,
      null,
      this.LONG_TIMEOUT,
    );
  }

  async isDisplayedFileContentVisible() {
    return await this.isElementVisible(
      this.visibleDisplayedFileContentTextareaSelector,
      null,
      this.LONG_TIMEOUT,
    );
  }

  async getDisplayedFileContentText() {
    return await this.getTextFromInputField(
      this.visibleDisplayedFileContentTextareaSelector,
      null,
      this.LONG_TIMEOUT,
    );
  }

  async fillInExistingFileNickname(nickname: string) {
    await this.fill(this.existingFileNicknameInputSelector, nickname);
  }

  async fillInExistingFileDescription(description: string) {
    await this.fill(this.existingFileDescriptionTextareaSelector, description);
  }

  async clickOnUpdateFileButton() {
    await this.click(this.updateFileButtonSelector);
  }

  async clickOnAppendFileButton() {
    await this.click(this.appendFileButtonSelector);
  }

  async clickOnReadFileButton() {
    await this.click(this.readFileButtonSelector);
  }

  async clickOnAddExistingFileLink() {
    await this.click(this.addExistingLinkSelector);
  }

  async clickOnLinkFileButton() {
    await this.click(this.linkFileButtonSelector);
  }

  async isLinkFileButtonDisabled() {
    return await this.isDisabled(this.linkFileButtonSelector);
  }

  async fillInExistingFileId(fileId: string) {
    await this.fill(this.existingFileIdInputSelector, fileId);
  }

  async getFileIdText() {
    return await this.getText(this.fileIdTextSelector, null, 3000);
  }

  async getFileSizeText() {
    return await this.getText(this.fileSizeTextSelector);
  }

  async getFileKeyText() {
    return await this.getText(this.fileKeyTextSelector);
  }

  async getFileKeyTypeText() {
    return await this.getText(this.fileKeyTypeTextSelector);
  }

  async getFileMemoText() {
    return await this.getText(this.fileMemoTextSelector);
  }

  async getFileLedgerText() {
    return await this.getText(this.fileLedgerTextSelector);
  }

  async getFileExpirationText() {
    return await this.getText(this.fileExpirationTextSelector);
  }

  async getFileDescriptionText() {
    return (await this.getText(this.fileDescriptionTextSelector))?.trim() ?? null;
  }

  async isFileDeletedWarningVisible() {
    return await this.isElementVisible(
      this.fileDeletedWarningSelector,
      null,
      this.VERY_LONG_TIMEOUT,
    );
  }

  async getFirstFileFromList() {
    return this.unlikedFiles[0];
  }

  async isUnlinkedFilesEmpty() {
    return this.unlikedFiles.length === 0;
  }

  async addFileToUnliked(fileId: string) {
    this.unlikedFiles.push(fileId);
  }

  async clickOnFilesMenuButton() {
    await this.click(this.filesMenuButtonSelector);
  }

  async clickOnConfirmUnlinkFileButton() {
    await this.click(this.confirmUnlinkFileButtonSelector);
  }

  async getFirstFileIdFromPage() {
    return await this.getText(this.fileIdListPrefixSelector + '0');
  }

  async clickOnAddNewButtonForFile() {
    await this.click(this.addNewButtonSelector);
  }

  async clickOnFileCardByFileId(fileId: string) {
    await this.waitForElementToBeVisible(this.addNewButtonSelector);
    const index = await this.findFileByIndex(fileId);
    if (index === -1) {
      throw new Error(`File ${fileId} was not found in the list`);
    }
    await this.click(this.fileIdListPrefixSelector + index);
  }

  async clickOnFileCheckbox(fileId: string) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    const index = await this.findFileByIndex(fileId);
    await this.click(this.multiSelectFileCheckboxSelector + index);
  }

  async findFileByIndex(fileId: string) {
    const count = await this.countElements(this.fileIdListPrefixSelector);
    if (count === 0) {
      return 0;
    } else {
      for (let i = 0; i < count; i++) {
        const idText = await this.getText(this.fileIdListPrefixSelector + i);
        if (idText === fileId) {
          return i;
        }
      }
      return -1; // Return -1 if the account ID is not found
    }
  }

  async isFileCardVisible(fileId: string) {
    await this.waitForElementToBeVisible(this.addNewButtonSelector);
    const index = await this.findFileByIndex(fileId);
    if (index === -1) {
      return false; // file not found
    } else {
      return await this.isElementVisible(this.fileIdListPrefixSelector + index);
    }
  }

  async isFileCardHidden(fileId: string) {
    await this.waitForElementToBeVisible(this.addNewButtonSelector);
    const index = await this.findFileByIndex(fileId);
    if (index === -1) {
      return true; // file not found
    } else {
      return await this.isElementHidden(this.fileIdListPrefixSelector + index);
    }
  }

  async ensureFileExistsAndUnlinked() {
    if (await this.isUnlinkedFilesEmpty()) {
      const { fileId } = await this.transactionPage.createFile('test');
      await this.clickOnFilesMenuButton();
      await this.clickOnRemoveFileCardButton();
      await this.clickOnConfirmUnlinkFileButton();
      await this.addFileToUnliked(fileId ?? '');
      await this.waitForElementToDisappear(this.toastMessageSelector);
    }
  }

  async clickOnSelectManyFilesButton() {
    await this.click(this.selectManyFilesButtonSelector);
  }
}
