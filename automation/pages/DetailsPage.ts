import { BasePage } from './BasePage.js';
import { expect, Page } from '@playwright/test';

export class DetailsPage extends BasePage {
  // Buttons
  transactionDetailsButtonIndexSelector = 'button-transaction-details-';

  /* Selectors */
  viewContentsButtonSelector = 'button-view-file-contents';
  seeKeyDetailsButtonSelector = 'button-file-details-key';
  //Text
  transactionCreatedAtIndexSelector = 'td-transaction-createdAt-';
  transactionStatusIndexSelector = 'td-transaction-status-';
  transactionTypeIndexSelector = 'td-transaction-type-';
  transactionDescriptionIndexSelector = 'td-transaction-description-';
  transactionIdIndexSelector = 'td-transaction-id-';
  transactionDetailsCreatedAtSelector = 'p-transaction-details-created-at';
  transactionDetailsExecutedAtSelector = 'p-transaction-details-executed_at';
  transactionDetailsTypeSelector = 'p-transaction-details-type';
  transactionDetailsIdSelector = 'p-transaction-details-id';
  transactionDetailsValidStartSelector = 'p-transaction-details-valid-start';
  transactionDetailsFeePayerSelector = 'p-transaction-details-fee-payer';
  transactionDetailsMemoSelector = 'p-transaction-details-memo';
  accountDetailsKeySelector = 'p-account-details-key';
  accountDetailsMemoSelector = 'p-account-details-memo';
  accountDetailsStakingSelector = 'p-account-details-staking';
  accountDetailsAcceptRewardsSelector = 'p-account-details-accept-rewards';
  accountDetailsReceiverSigRequiredSelector = 'p-account-details-receiver-sig-required';
  accountDetailsInitBalanceSelector = 'p-account-details-init-balance';
  accountUpdateDetailsIdSelector = 'p-account-details-id';
  accountDeleteDetailsDeletedAccountIdSelector = 'p-account-delete-details-account-id';
  accountDeleteDetailsTransferIdSelector = 'p-account-delete-details-transfer-account-id';
  transferDetailsFromAccountSelector = 'p-transfer-from-account-details';
  transferDetailsFromAmountSelector = 'p-transfer-from-amount-details';
  transferDetailsToAccountSelector = 'p-transfer-to-account-details';
  transferDetailsToAmountSelector = 'p-transfer-to-amount-details';
  allowanceDetailsOwnerAccountSelector = 'p-account-approve-details-owner-id';
  allowanceDetailsSpenderAccountSelector = 'p-account-approve-details-spender-id';
  allowanceDetailsAmountSelector = 'p-account-approve-details-amount';
  fileDetailsExpirationTimeSelector = 'p-file-details-expiration-time';
  fileDetailsFileIdSelector = 'p-file-details-file-id';
  transactionDescriptionSelector = 'p-description-field';
  breadCrumbItemSelector = 'breadcrumb-item-';

  constructor(window: Page) {
    super(window);
  }

  async clickOnFirstTransactionDetailsButton() {
    await this.click(this.transactionDetailsButtonIndexSelector + '0');
  }

  async getFirstTransactionCreated() {
    return await this.getText(this.transactionCreatedAtIndexSelector + '0');
  }

  async getFirstTransactionStatus() {
    return await this.getText(this.transactionStatusIndexSelector + '0');
  }

  async getFirstTransactionType() {
    return await this.getText(this.transactionTypeIndexSelector + '0');
  }

  async getFirstTransactionDescription() {
    return await this.getText(this.transactionDescriptionIndexSelector + '0');
  }

  async getFirstTransactionId() {
    return await this.getText(this.transactionIdIndexSelector + '0');
  }

  async isTransactionDetailsButtonVisible() {
    return this.isElementVisible(this.transactionDetailsButtonIndexSelector + '0');
  }

  async getTransactionDetailsType() {
    return await this.getText(this.transactionDetailsTypeSelector);
  }

  async getTransactionDetailsId() {
    return await this.getText(this.transactionDetailsIdSelector);
  }

  async getTransactionDetailsCreatedAt() {
    return await this.getText(this.transactionDetailsCreatedAtSelector);
  }

  async getTransactionDetailsExecutedAt() {
    return await this.getText(this.transactionDetailsExecutedAtSelector);
  }

  async getValidStart() {
    return await this.getText(this.transactionDetailsValidStartSelector);
  }

  async getTransactionDetailsFeePayer() {
    return await this.getText(this.transactionDetailsFeePayerSelector);
  }

  async getTransactionDetailsMemo() {
    return await this.getText(this.transactionDetailsMemoSelector);
  }

  async getAccountUpdateDetailsId() {
    return await this.getText(this.accountUpdateDetailsIdSelector);
  }

  async getAccountDetailsKey() {
    return await this.getText(this.accountDetailsKeySelector);
  }

  async getAccountDetailsMemo() {
    return await this.getText(this.accountDetailsMemoSelector);
  }

  async getAccountDetailsStaking() {
    return await this.getText(this.accountDetailsStakingSelector);
  }

  async getAccountDetailsAcceptRewards() {
    return await this.getText(this.accountDetailsAcceptRewardsSelector);
  }

  async getAccountDetailsReceiverSigRequired() {
    return await this.getText(this.accountDetailsReceiverSigRequiredSelector);
  }

  async getAccountDetailsInitBalance() {
    return await this.getText(this.accountDetailsInitBalanceSelector);
  }

  async getDeletedAccountId() {
    return await this.getText(this.accountDeleteDetailsDeletedAccountIdSelector);
  }

  async getAccountDeleteDetailsTransferId() {
    return await this.getText(this.accountDeleteDetailsTransferIdSelector);
  }

  async getTransferDetailsFromAccount() {
    return await this.getText(this.transferDetailsFromAccountSelector);
  }

  async getTransferDetailsFromAmount() {
    return await this.getText(this.transferDetailsFromAmountSelector);
  }

  async getTransferDetailsToAccount() {
    return await this.getText(this.transferDetailsToAccountSelector);
  }

  async getTransferDetailsToAmount() {
    return await this.getText(this.transferDetailsToAmountSelector);
  }

  async getAllowanceDetailsOwnerAccount() {
    return await this.getText(this.allowanceDetailsOwnerAccountSelector);
  }

  async getAllowanceDetailsSpenderAccount() {
    return await this.getText(this.allowanceDetailsSpenderAccountSelector);
  }

  async getAllowanceDetailsAmount() {
    return await this.getText(this.allowanceDetailsAmountSelector);
  }

  async isViewContentsButtonVisible() {
    return await this.isElementVisible(this.viewContentsButtonSelector);
  }

  async isSeeKeyDetailsButtonVisible() {
    return await this.isElementVisible(this.seeKeyDetailsButtonSelector);
  }

  async getFileDetailsExpirationTime() {
    return await this.getText(this.fileDetailsExpirationTimeSelector);
  }

  async getFileDetailsFileId() {
    return await this.getText(this.fileDetailsFileIdSelector);
  }

  async assertTransactionDisplayed(
    expectedId: string,
    expectedType: string,
    expectedDescription: string | null = null,
  ) {
    const transactionId = await this.getFirstTransactionId();
    expect(expectedId.toString()).toContain(transactionId);

    const transactionType = await this.getFirstTransactionType();
    expect(transactionType).toBe(expectedType);

    if (expectedDescription) {
      const transactionDescription = await this.getFirstTransactionDescription();
      expect(transactionDescription).toBe(expectedDescription);
    }

    const transactionStatus = await this.getFirstTransactionStatus();
    expect(transactionStatus).toBe('SUCCESS');

    const transactionCreatedAt = await this.getFirstTransactionCreated();
    expect(transactionCreatedAt).toBeTruthy();

    const isTransactionDetailsButtonVisible = await this.isTransactionDetailsButtonVisible();
    expect(isTransactionDetailsButtonVisible).toBe(true);
  }

  async assertTransactionDetails(
    expectedId: string,
    expectedType: string,
    extraAssertions: (() => Promise<void>) | null = null,
  ) {
    const transactionId = await this.getTransactionDetailsId();
    expect(expectedId.toString()).toContain(transactionId);

    const transactionType = await this.getTransactionDetailsType();
    expect(transactionType).toBe(expectedType);

    const transactionCreatedAt = await this.getTransactionDetailsCreatedAt();
    expect(transactionCreatedAt).toBeTruthy();

    const transactionExecutedAt = await this.getTransactionDetailsExecutedAt();
    expect(transactionExecutedAt).toBeTruthy();

    const validStart = await this.getValidStart();
    expect(validStart).toBeTruthy();

    const transactionFeePayer = await this.getTransactionDetailsFeePayer();
    expect(transactionFeePayer).toBeTruthy();

    if (extraAssertions) {
      await extraAssertions();
    }
  }

  async getTransactionDescription() {
    return await this.getText(this.transactionDescriptionSelector);
  }

  async getBreadCrumbItem(index: number) {
    return this.window.getByTestId(`${this.breadCrumbItemSelector}${index}`);
  }
}
