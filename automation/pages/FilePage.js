const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');

class FilePage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.unlikedFiles = []; // Store unliked files
    this.transactionPage = new TransactionPage(window);
  }

  /* Selectors */

  // Buttons
  removeFileCardButtonSelector = 'button-remove-file-card';
  updateFileButtonSelector = 'button-update-file';
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

  async clickOnRemoveFileCardButton() {
    await this.clickByTestId(this.removeFileCardButtonSelector);
  }

  async clickOnUpdateFileButton() {
    await this.clickByTestId(this.updateFileButtonSelector);
  }

  async clickOnAppendFileButton() {
    await this.clickByTestId(this.appendFileButtonSelector);
  }

  async clickOnReadFileButton() {
    await this.clickByTestId(this.readFileButtonSelector);
  }

  async clickOnAddNewFileButton() {
    await this.clickByTestId(this.addNewButtonSelector);
  }

  async clickOnCreateNewFileLink() {
    await this.clickByTestId(this.createNewLinkSelector);
  }

  async clickOnUpdateFileLink() {
    await this.clickByTestId(this.updateLinkSelector);
  }

  async clickOnAppendFileLink() {
    await this.clickByTestId(this.appendLinkSelector);
  }

  async clickOnReadFileLink() {
    await this.clickByTestId(this.readLinkSelector);
  }

  async clickOnAddExistingFileLink() {
    await this.clickByTestId(this.addExistingLinkSelector);
  }

  async clickOnLinkFileButton() {
    await this.clickByTestId(this.linkFileButtonSelector);
  }

  async fillInExistingFileId(fileId) {
    await this.fillByTestId(this.existingFileIdInputSelector, fileId);
  }

  async getFileIdText() {
    return await this.getTextByTestId(this.fileIdTextSelector, 3000);
  }

  async getFileSizeText() {
    return await this.getTextByTestId(this.fileSizeTextSelector);
  }

  async getFileKeyText() {
    return await this.getTextByTestId(this.fileKeyTextSelector);
  }

  async getFileKeyTypeText() {
    return await this.getTextByTestId(this.fileKeyTypeTextSelector);
  }

  async getFileMemoText() {
    return await this.getTextByTestId(this.fileMemoTextSelector);
  }

  async getFileLedgerText() {
    return await this.getTextByTestId(this.fileLedgerTextSelector);
  }

  async getFileExpirationText() {
    return await this.getTextByTestId(this.fileExpirationTextSelector);
  }

  async getFileDescriptionText() {
    return await this.getTextByTestId(this.fileDescriptionTextSelector);
  }

  async getFirstFileFromList() {
    return await this.unlikedFiles[0];
  }

  async isUnlinkedFilesEmpty() {
    return this.unlikedFiles.length === 0;
  }

  async addFileToUnliked(fileId) {
    this.unlikedFiles.push(fileId);
  }

  async clickOnFilesMenuButton() {
    await this.clickByTestId(this.filesMenuButtonSelector);
  }

  async clickOnConfirmUnlinkFileButton() {
    await this.clickByTestId(this.confirmUnlinkFileButtonSelector);
  }

  async getFirstFileIdFromPage() {
    return await this.getTextByTestId(this.fileIdListPrefixSelector + '0');
  }

  async clickOnAddNewButtonForFile() {
    await this.clickByTestId(this.addNewButtonSelector);
  }

  async clickOnFileCheckbox(fileId) {
    const { delay } = await import('../utils/util.js');
    await delay(1000);
    const index = await this.findFileByIndex(fileId);
    await this.clickByTestId(this.multiSelectFileCheckboxSelector + index);
  }

  async findFileByIndex(fileId) {
    const count = await this.countElementsByTestId(this.fileIdListPrefixSelector);
    if (count === 0) {
      return 0;
    } else {
      for (let i = 0; i < count; i++) {
        const idText = await this.getTextByTestId(this.fileIdListPrefixSelector + i);
        if (idText === fileId) {
          return i;
        }
      }
      return -1; // Return -1 if the account ID is not found
    }
  }

  async isFileCardVisible(fileId) {
    await this.waitForElementToBeVisible(this.addNewButtonSelector);
    const index = await this.findFileByIndex(fileId);
    if (index === -1) {
      return false; // file not found
    } else {
      return await this.isElementVisible(this.fileIdListPrefixSelector + index);
    }
  }

  async ensureFileExistsAndUnlinked() {
    if (await this.isUnlinkedFilesEmpty()) {
      const { fileId } = await this.transactionPage.createFile('test');
      await this.clickOnFilesMenuButton();
      await this.clickOnRemoveFileCardButton();
      await this.clickOnConfirmUnlinkFileButton();
      await this.addFileToUnliked(fileId);
      await this.waitForElementToDisappear(this.toastMessageSelector);
    }
  }

  async clickOnSelectManyFilesButton() {
    await this.clickByTestId(this.selectManyFilesButtonSelector);
  }
}

module.exports = FilePage;
