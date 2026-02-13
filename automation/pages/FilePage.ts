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
  createNewLinkSelector = 'link-create-new-file';
  updateLinkSelector = 'link-update-file';
  appendLinkSelector = 'link-append-file';
  readLinkSelector = 'link-read-file';
  addExistingLinkSelector = 'link-add-existing-file';
  linkFileButtonSelector = 'button-link-file';
  confirmUnlinkFileButtonSelector = 'button-confirm-unlink-file';
  filesMenuButtonSelector = 'button-menu-files';
  selectManyFilesButtonSelector = 'button-select-many-files';
  // Inputs
  existingFileIdInputSelector = 'input-existing-file-id';
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
  fileIdListPrefixSelector = 'p-file-id-';
  toastMessageSelector = '.v-toast__text';
  private readonly unlikedFiles: string[]; // Store unlinked files
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

  async clickOnUpdateFileButton() {
    await this.click(this.updateFileButtonSelector);
  }

  async clickOnAppendFileButton() {
    await this.click(this.appendFileButtonSelector);
  }

  async clickOnReadFileButton() {
    await this.click(this.readFileButtonSelector);
  }

  async clickOnAddNewFileButton() {
    await this.click(this.addNewButtonSelector);
  }

  async clickOnCreateNewFileLink() {
    await this.click(this.createNewLinkSelector);
  }

  async clickOnUpdateFileLink() {
    await this.click(this.updateLinkSelector);
  }

  async clickOnAppendFileLink() {
    await this.click(this.appendLinkSelector);
  }

  async clickOnReadFileLink() {
    await this.click(this.readLinkSelector);
  }

  async clickOnAddExistingFileLink() {
    await this.click(this.addExistingLinkSelector);
  }

  async clickOnLinkFileButton() {
    await this.click(this.linkFileButtonSelector);
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
    return await this.getText(this.fileDescriptionTextSelector);
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
