import { BasePage } from './BasePage.js';
import { TransactionPage } from './TransactionPage.js';
import { Page } from '@playwright/test';
import { generateCSVFile } from '../utils/files/csvGenerator.js';
import { getTransactionGroupsForTransactionId } from '../utils/db/databaseQueries.js';
import { OrganizationPage } from './OrganizationPage.js';

export class GroupPage extends BasePage {
  organizationPage: OrganizationPage;
  private readonly transactionPage: TransactionPage;

  constructor(window: Page) {
    super(window);
    this.transactionPage = new TransactionPage(window);
    this.organizationPage = new OrganizationPage(window);
  }

  /* Selectors */

  // Buttons
  backButtonSelector = 'button-back';
  saveGroupButtonSelector = 'button-save-group';
  signAndExecuteButtonSelector = 'button-sign-submit';
  addTransactionButtonSelector = 'button-add-transaction';
  transactionGroupButtonSelector = 'span-group-transaction';
  deleteGroupButtonSelector = 'button-delete-group-modal';
  continueEditingButtonSelector = 'button-continue-editing';
  addToGroupButtonSelector = 'button-add-to-group';
  discardModalDraftButtonSelector = 'button-discard-group-modal';
  discardDraftTransactionModalButtonSelector = 'button-discard-draft-for-group-modal';
  deleteAllButtonSelector = 'button-delete-all';
  confirmDeleteAllButtonSelector = 'button-confirm-delete-all';
  confirmGroupTransactionButtonSelector = 'button-confirm-group-transaction';
  detailsGroupButtonSelector = 'button-transaction-node-details-';
  importCsvButtonSelector = 'button-import-csv';
  moreDropdownButtonSelector = 'button-more-dropdown-lg';
  cancelAllButtonSelector = 'button-more-dropdown-lg-item-Cancel All';
  firstTransactionDetailsButtonLocator = '[data-testid="button-transaction-node-details-0"]';
  // Text
  toastMessageSelector = 'css=.v-toast__text';
  emptyTransactionTextSelector = 'p-empty-transaction-text';
  transactionGroupDetailsIdSelector = 'td-group-transaction-id';
  // Inputs
  descriptionInputSelector = 'input-transaction-group-description';
  //Indexes
  transactionTypeIndexSelector = 'span-transaction-type-';
  transactionTimestampIndexSelector = 'div-transaction-id-';
  transactionDeleteButtonIndexSelector = 'button-transaction-delete-';
  transactionDuplicateButtonIndexSelector = 'button-transaction-duplicate-';
  transactionEditButtonIndexSelector = 'button-transaction-edit-';
  orgTransactionDetailsButtonIndexSelector = 'button-group-transaction-';
  closeModalScreenshotPrefixSelector = 'close-modal-';

  async closeModalIfVisible(selector: string) {
    const modalButton = this.getElement(selector);
    if (await this.isElementVisible(selector, null, this.LONG_TIMEOUT)) {
      await modalButton.click();
      await this.captureStepScreenshot(`${this.closeModalScreenshotPrefixSelector}${selector}`);
    }
  }

  async deleteGroupModal() {
    await this.closeModalIfVisible(this.deleteGroupButtonSelector);
  }

  async closeGroupDraftModal() {
    await this.closeModalIfVisible(this.discardModalDraftButtonSelector);
  }

  async closeDraftTransactionModal() {
    await this.closeModalIfVisible(this.discardDraftTransactionModalButtonSelector);
  }

  async clickOnBackButton() {
    await this.click(this.backButtonSelector);
  }

  async clickOnSaveGroupButton() {
    await this.click(this.saveGroupButtonSelector);
  }

  async clickOnSignAndExecuteButton() {
    await this.waitForElementToBeVisible(this.signAndExecuteButtonSelector, this.LONG_TIMEOUT);
    await this.click(this.signAndExecuteButtonSelector);
  }

  async isSignAndExecuteButtonDisabled() {
    return await this.isDisabled(this.signAndExecuteButtonSelector);
  }

  async clickOnAddTransactionButton() {
    await this.click(this.addTransactionButtonSelector);
  }

  async fillDescription(description: string) {
    await this.fill(this.descriptionInputSelector, description);
  }

  async verifyGroupElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.saveGroupButtonSelector),
      this.isElementVisible(this.signAndExecuteButtonSelector),
      this.isElementVisible(this.addTransactionButtonSelector),
      this.isElementVisible(this.descriptionInputSelector),
    ]);

    return checks.every(isTrue => isTrue);
  }

  async navigateToGroupTransaction() {
    await this.click(this.transactionPage.createNewTransactionButtonSelector);
    await this.click(this.transactionGroupButtonSelector);
  }

  async clickOnDeleteGroupButton() {
    await this.click(this.deleteGroupButtonSelector);
  }

  async clickOnContinueEditingButton() {
    await this.click(this.continueEditingButtonSelector);
  }

  async isDeleteModalHidden() {
    return this.isElementHidden(this.deleteGroupButtonSelector);
  }

  async getToastMessage(dismissToast = false) {
    const message = await this.getText(this.toastMessageSelector, null, this.DEFAULT_TIMEOUT);
    if (dismissToast) {
      await this.click(this.toastMessageSelector);
    }
    return message;
  }

  async clickAddToGroupButton() {
    const buttonCount = await this.getElement(this.addToGroupButtonSelector).count();

    for (let index = 0; index < buttonCount; index++) {
      const isVisible = await this.isElementVisible(
        this.addToGroupButtonSelector,
        index,
        this.SHORT_TIMEOUT,
      );
      const isDisabled = isVisible
        ? await this.isDisabled(this.addToGroupButtonSelector, index, this.SHORT_TIMEOUT)
        : true;

      if (isVisible && !isDisabled) {
        await this.click(this.addToGroupButtonSelector, index, this.SHORT_TIMEOUT);
        return;
      }
    }

    throw new Error(
      `No visible and enabled "${this.addToGroupButtonSelector}" button was found among ${buttonCount} element(s).`,
    );
  }

  async isAddToGroupButtonEnabled() {
    const buttonCount = await this.getElement(this.addToGroupButtonSelector).count();

    for (let index = 0; index < buttonCount; index++) {
      const isVisible = await this.isElementVisible(
        this.addToGroupButtonSelector,
        index,
        this.SHORT_TIMEOUT,
      );
      if (!isVisible) continue;

      const isDisabled = await this.isDisabled(
        this.addToGroupButtonSelector,
        index,
        this.SHORT_TIMEOUT,
      );
      return !isDisabled;
    }

    return false;
  }

  async getTransactionType(index: number) {
    return await this.getText(this.transactionTypeIndexSelector + index);
  }

  async getTransactionTimestamp(index: number, timeout?: number): Promise<string | null> {
    return await this.getText(this.transactionTimestampIndexSelector + index, null, timeout);
  }

  async getTransactionGroupDetailsId(index: number): Promise<string | null> {
    return await this.getText(this.transactionGroupDetailsIdSelector, index);
  }

  async getAllTransactionTimestamps(
    numberOfTransactions: number,
    timeout: number = this.SHORT_TIMEOUT,
  ): Promise<string[]> {
    const timestamps: string[] = [];

    for (let i = 0; i < numberOfTransactions; i++) {
      const timestamp = await this.getTransactionTimestamp(i, timeout);

      if (timestamp) {
        timestamps.push(timestamp);
      }
    }
    return timestamps;
  }

  async verifyAllTransactionsAreSuccessful(timestampsForVerification: string[]) {
    for (let i = 0; i < timestampsForVerification.length; i++) {
      const transactionDetails = await this.transactionPage.mirrorGetTransactionResponse(
        timestampsForVerification[i],
      );
      const result = transactionDetails?.result;
      if (result !== 'SUCCESS') {
        return false;
      }
    }
    return true;
  }

  async clickTransactionDeleteButton(index: number) {
    await this.click(this.transactionDeleteButtonIndexSelector + index);
  }

  async clickTransactionDuplicateButton(index: number) {
    await this.click(this.transactionDuplicateButtonIndexSelector + index);
  }

  async clickTransactionEditButton(index: number) {
    await this.click(this.transactionEditButtonIndexSelector + index);
  }

  async isTransactionHidden(index: number) {
    return this.isElementHidden(this.transactionTypeIndexSelector + index);
  }

  async addSingleTransactionToGroup(numberOfTransactions = 1, isFileTransaction = false) {
    if (isFileTransaction) {
      await this.clickOnAddTransactionButton();
      await this.transactionPage.clickOnFileServiceLink();
      await this.transactionPage.clickOnFileCreateTransaction();
      await this.clickAddToGroupButton();
    } else {
      await this.fillDescription('test');
      for (let i = 0; i < numberOfTransactions; i++) {
        await this.clickOnAddTransactionButton();
        await this.transactionPage.clickOnCreateAccountTransaction();
        await this.clickAddToGroupButton();
      }
    }
  }

  async generateAndImportCsvFile(
    fromAccountId: string,
    receiverAccountId: string,
    numberOfTransactions: number = 10,
    feePayerAccountId: string | null = null,
  ) {
    const fileName = 'groupTransactions.csv';
    const filePath = await generateCSVFile({
      senderAccount: fromAccountId,
      feePayerAccount: feePayerAccountId,
      accountId: receiverAccountId,
      startingAmount: 1,
      numberOfTransactions: numberOfTransactions,
      fileName: fileName,
    });
    await this.uploadFile(this.importCsvButtonSelector, filePath);
    // Wait for all transactions to be loaded before proceeding
    const lastTxIndex = numberOfTransactions - 1;
    await this.waitForElementToBeVisible(this.transactionTypeIndexSelector + lastTxIndex);
  }

  async importCsvExpectingError(
    fromAccountId: string,
    receiverAccountId: string,
    numberOfTransactions: number = 10,
    feePayerAccountId: string | null = null,
  ) {
    const fileName = 'groupTransactions.csv';
    const filePath = await generateCSVFile({
      senderAccount: fromAccountId,
      feePayerAccount: feePayerAccountId,
      accountId: receiverAccountId,
      startingAmount: 1,
      numberOfTransactions: numberOfTransactions,
      fileName: fileName,
    });
    await this.uploadFile(this.importCsvButtonSelector, filePath);
    return await this.getToastMessage(true);
  }

  async addOrgAllowanceTransactionToGroup(
    numberOfTransactions = 1,
    allowanceOwner: string,
    amount: string,
  ) {
    await this.fillDescription('test');
    for (let i = 0; i < numberOfTransactions; i++) {
      await this.clickOnAddTransactionButton();
      await this.transactionPage.clickOnApproveAllowanceTransaction();
      await this.transactionPage.fillInMaxTransactionFee('5');
      await this.transactionPage.fillInAllowanceOwner(allowanceOwner);
      await this.transactionPage.fillInAllowanceAmount(amount);
      await this.transactionPage.fillInSpenderAccountId(
        await this.transactionPage.getPayerAccountId(),
        this.addToGroupButtonSelector,
      );

      await this.clickAddToGroupButton();
    }
  }

  async isEmptyTransactionTextVisible() {
    return this.isElementVisible(this.emptyTransactionTextSelector);
  }

  async getEmptyTransactionText() {
    return ((await this.getText(this.emptyTransactionTextSelector)) ?? '').trim();
  }

  async clickOnDeleteAllButton() {
    await this.click(this.deleteAllButtonSelector);
  }

  async clickOnConfirmDeleteAllButton() {
    await this.click(this.confirmDeleteAllButtonSelector);
  }

  async clickOnCancelDeleteAllButton() {
    const confirmButton = this.getElement(this.confirmDeleteAllButtonSelector);
    await confirmButton.waitFor({ state: 'visible', timeout: this.LONG_TIMEOUT });
    const modalContent = confirmButton
      .locator('xpath=ancestor::*[contains(@class,"modal-content")]')
      .first();
    await modalContent.getByRole('button', { name: 'Cancel', exact: true }).click();
  }

  async clickOnConfirmGroupTransactionButton() {
    await this.waitForElementToBeVisible(
      this.confirmGroupTransactionButtonSelector,
      this.DEFAULT_TIMEOUT,
    );
    await this.click(this.confirmGroupTransactionButtonSelector);
  }

  /**
   * Checks if transaction groups exist for the given transaction ID.
   *
   * @param {string} transactionId - The ID of the transaction to check.
   * @returns {Promise<boolean>} A promise that resolves to true if transaction groups exist, otherwise false.
   */
  async doTransactionGroupsExist(transactionId: string): Promise<boolean> {
    return !!(await getTransactionGroupsForTransactionId(transactionId));
  }

  async clickOnDetailsGroupButton(index: number) {
    const selector = this.detailsGroupButtonSelector + index;
    await this.waitForElementToBeVisible(selector, this.LONG_TIMEOUT);
    await this.click(selector);
  }

  async clickOnTransactionDetailsButton(index: number) {
    const selector = this.orgTransactionDetailsButtonIndexSelector + index;
    await this.waitForElementToBeVisible(selector, this.LONG_TIMEOUT);
    await this.click(selector);
  }

  async logInAndSignGroupTransactionsByAllUsers(encryptionPassword: string, signAll = true) {
    const readyToSignMaxRetries = 30;
    const readyToSignRetryDelayMs = this.DEFAULT_TIMEOUT;

    for (let i = 1; i < this.organizationPage.users.length; i++) {
      console.log(`Signing transaction for user ${i}`);
      const user = this.organizationPage.users[i];
      await this.organizationPage.signInOrganization(user.email, user.password, encryptionPassword);
      await this.transactionPage.clickOnTransactionsMenuButton();
      await this.organizationPage.clickOnReadyToSignTab();

      // Poll for transaction to appear (handles cache race condition)
      // Backend cache linking can take 10-30s+ depending on mirror node latency
      const found = await this.waitForTransactionInTab(
        this.organizationPage.readyToSignTabSelector,
        readyToSignMaxRetries,
        readyToSignRetryDelayMs,
      );

      if (!found) {
        throw new Error(
          `User ${i} (${user.email}) could not find a transaction in Ready to Sign after ${readyToSignMaxRetries} attempts with a ${readyToSignRetryDelayMs}ms retry delay`,
        );
      }

      await this.clickOnDetailsGroupButton(0);
      if (signAll) {
        await this.clickOnSignAllButton();
        await this.clickOnConfirmSignAllButton();
      } else {
        await this.clickOnTransactionDetailsButton(0);

        // Sign the first transaction and continue while "Next" button is visible
        do {
          // Trying to catch an intermittent issue.
          const canSign = await this.organizationPage.isSignTransactionButtonVisible();
          if (!canSign) {
            console.log(`Sign not available for user ${i}, skipping.`);
            break;
          }
          await this.organizationPage.clickOnSignTransactionButton();
          // Wait for 1 second to allow details to load
          // await new Promise(resolve => setTimeout(resolve, 5000));

          // Next cursor can be visible but disabled at collection boundaries.
          const hasEnabledNext = (await this.organizationPage.isNextTransactionButtonVisible()) &&
            (await this.organizationPage.isNextTransactionButtonEnabled());

          if (hasEnabledNext) {
            console.log(`User ${i} signed a transaction, moving to the next one.`);
            await this.organizationPage.clickOnNextTransactionButton();
          } else {
            console.log(`No more transactions to sign for user ${i}.`);
            break;
          }
        } while (true);
      }
      await this.waitForElementToDisappear(this.toastMessageSelector);
      await this.organizationPage.logoutFromOrganization();
    }
  }

  async clickOnSignAllButton(holdTimeout: number = 600) {
    await this.organizationPage.clickOnSignAllTransactionsButton(holdTimeout);
  }

  async clickOnCancelAllButton() {
    await this.waitForElementToBeVisible(this.moreDropdownButtonSelector, this.VERY_LONG_TIMEOUT);
    await this.click(this.moreDropdownButtonSelector);
    await this.click(this.cancelAllButtonSelector);
  }

  async clickOnConfirmSignAllButton() {
    await this.organizationPage.clickOnConfirmSignAllButton();
  }

  async clickOnConfirmCancelAllButton() {
    await this.organizationPage.clickOnConfirmCancelAllButton();
  }

  /**
   * Wait for transaction to appear in specified tab with retry logic.
   * Handles cache race condition where transaction_cached_account links
   * are populated asynchronously after User 0 signs.
   *
   * Backend cache population timing:
   * - processTransactionStatus() calls computeSignatureKey()
   * - computeSignatureKey() calls getAccountInfoForTransaction()
   * - getAccountInfoForTransaction() fetches from mirror node (5-15s) + creates links
   * - Total time can be 10-30s depending on mirror node latency
   *
   * @param tabSelector - Tab selector (e.g., organizationPage.readyToSignTabSelector)
   * @param maxRetries - Maximum number of retry attempts (default: 15)
   * @param delayMs - Delay between retries in milliseconds (default: 2000)
   * @returns true if transaction found, false otherwise
   */
  async waitForTransactionInTab(
    tabSelector: string,
    maxRetries: number = 60,
    delayMs: number = this.DEFAULT_TIMEOUT,
  ): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        // Navigate to the tab (using click method directly since no generic clickOnTab exists)
        await this.organizationPage.click(tabSelector);

        // SKIP loader wait - it never disappears (stays visible in DOM with display:block)
        // Transaction renders immediately even with loader visible

        await this.waitForElementToBeVisible(
          this.firstTransactionDetailsButtonLocator,
          this.LONG_TIMEOUT,
        );

        console.log(`Transaction found in tab after ${i + 1} attempt(s)`);
        return true;
      } catch (error: any) {
        console.log(
          `Transaction not found, retrying in ${delayMs}ms... (attempt ${i + 1}/${maxRetries})`,
        );
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    console.log(`Transaction not found after ${maxRetries} attempts`);
    return false;
  }
}
