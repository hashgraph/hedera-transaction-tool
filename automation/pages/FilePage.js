const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');
import { allure } from 'allure-playwright';

class FilePage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.unlikedFiles = []; // Store unliked files
    this.transactionPage = new TransactionPage(window);
  }

  /* Selectors */
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

  existingFileIdInputSelector = 'input-existing-file-id';
  multiSelectFileCheckboxSelector = 'checkbox-multiple-file-id-';

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
    return allure.step('Click on Remove File Card Button', async () => {
      await this.clickByTestId(this.removeFileCardButtonSelector);
    });
  }

  async clickOnUpdateFileButton() {
    return allure.step('Click on Update File Button', async () => {
      await this.clickByTestId(this.updateFileButtonSelector);
    });
  }

  async clickOnAppendFileButton() {
    return allure.step('Click on Append File Button', async () => {
      await this.clickByTestId(this.appendFileButtonSelector);
    });
  }

  async clickOnReadFileButton() {
    return allure.step('Click on Read File Button', async () => {
      await this.clickByTestId(this.readFileButtonSelector);
    });
  }

  async clickOnAddNewFileButton() {
    return allure.step('Click on Add New File Button', async () => {
      await this.clickByTestId(this.addNewButtonSelector);
    });
  }

  async clickOnCreateNewFileLink() {
    return allure.step('Click on Create New File Link', async () => {
      await this.clickByTestId(this.createNewLinkSelector);
    });
  }

  async clickOnUpdateFileLink() {
    return allure.step('Click on Update File Link', async () => {
      await this.clickByTestId(this.updateLinkSelector);
    });
  }

  async clickOnAppendFileLink() {
    return allure.step('Click on Append File Link', async () => {
      await this.clickByTestId(this.appendLinkSelector);
    });
  }

  async clickOnReadFileLink() {
    return allure.step('Click on Read File Link', async () => {
      await this.clickByTestId(this.readLinkSelector);
    });
  }

  async clickOnAddExistingFileLink() {
    return allure.step('Click on Add Existing File Link', async () => {
      await this.clickByTestId(this.addExistingLinkSelector);
    });
  }

  async clickOnLinkFileButton() {
    return allure.step('Click on Link File Button', async () => {
      await this.clickByTestId(this.linkFileButtonSelector);
    });
  }

  async fillInExistingFileId(fileId) {
    return allure.step('Fill in Existing File ID', async () => {
      await this.fillByTestId(this.existingFileIdInputSelector, fileId);
    });
  }

  async getFileIdText() {
    return allure.step('Get File ID Text', async () => {
      return await this.getTextByTestId(this.fileIdTextSelector);
    });
  }

  async getFileSizeText() {
    return allure.step('Get File Size Text', async () => {
      return await this.getTextByTestId(this.fileSizeTextSelector);
    });
  }

  async getFileKeyText() {
    return allure.step('Get File Key Text', async () => {
      return await this.getTextByTestId(this.fileKeyTextSelector);
    });
  }

  async getFileKeyTypeText() {
    return allure.step('Get File Key Type Text', async () => {
      return await this.getTextByTestId(this.fileKeyTypeTextSelector);
    });
  }

  async getFileMemoText() {
    return allure.step('Get File Memo Text', async () => {
      return await this.getTextByTestId(this.fileMemoTextSelector);
    });
  }

  async getFileLedgerText() {
    return allure.step('Get File Ledger Text', async () => {
      return await this.getTextByTestId(this.fileLedgerTextSelector);
    });
  }

  async getFileExpirationText() {
    return allure.step('Get File Expiration Text', async () => {
      return await this.getTextByTestId(this.fileExpirationTextSelector);
    });
  }

  async getFileDescriptionText() {
    return allure.step('Get File Description Text', async () => {
      return await this.getTextByTestId(this.fileDescriptionTextSelector);
    });
  }

  async getFirstFileFromList() {
    return allure.step('Get First File from List', async () => {
      return await this.unlikedFiles[0];
    });
  }

  async isUnlinkedFilesEmpty() {
    return allure.step('Check if Unlinked Files is Empty', async () => {
      return this.unlikedFiles.length === 0;
    });
  }

  async addFileToUnliked(fileId) {
    return allure.step('Add File to Unliked', async () => {
      this.unlikedFiles.push(fileId);
    });
  }

  async clickOnFilesMenuButton() {
    return allure.step('Click on Files Menu Button', async () => {
      await this.clickByTestId(this.filesMenuButtonSelector);
    });
  }

  async clickOnConfirmUnlinkFileButton() {
    return allure.step('Click on Confirm Unlink File Button', async () => {
      await this.clickByTestId(this.confirmUnlinkFileButtonSelector);
    });
  }

  async getFirstFileIdFromPage() {
    return allure.step('Get First File ID from Page', async () => {
      return await this.getTextByTestId(this.fileIdListPrefixSelector + '0');
    });
  }

  async clickOnAddNewButtonForFile() {
    return allure.step('Click on Add New Button for File', async () => {
      await this.clickByTestId(this.addNewButtonSelector);
    });
  }

  async clickOnFileCheckbox(fileId) {
    return allure.step('Click on File Checkbox', async () => {
      const { delay } = await import('../utils/util.js');
      await delay(1000);
      const index = await this.findFileByIndex(fileId);
      await this.clickByTestId(this.multiSelectFileCheckboxSelector + index);
    });
  }

  async findFileByIndex(fileId) {
    return allure.step('Find File by Index', async () => {
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
    });
  }

  async isFileCardVisible(fileId) {
    return allure.step('Check if File Card is Visible', async () => {
      await this.waitForElementToBeVisible(this.addNewButtonSelector);
      const index = await this.findFileByIndex(fileId);
      if (index === -1) {
        return false; // file not found
      } else {
        return await this.isElementVisible(this.fileIdListPrefixSelector + index);
      }
    });
  }

  async ensureFileExistsAndUnlinked(password) {
    return allure.step('Ensure File Exists and Unlinked', async () => {
      if (await this.isUnlinkedFilesEmpty()) {
        const { fileId } = await this.transactionPage.createFile('test', password);
        await this.clickOnFilesMenuButton();
        await this.clickOnRemoveFileCardButton();
        await this.clickOnConfirmUnlinkFileButton();
        await this.addFileToUnliked(fileId);
        await this.waitForElementToDisappear(this.toastMessageSelector);
      }
    });
  }

  async clickOnSelectManyFilesButton() {
    return allure.step('Click on Select Many Files Button', async () => {
      await this.clickByTestId(this.selectManyFilesButtonSelector);
    });
  }
}

module.exports = FilePage;
