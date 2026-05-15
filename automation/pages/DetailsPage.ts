import { BasePage } from './BasePage.js';
import { expect, Page } from '@playwright/test';

export class DetailsPage extends BasePage {
  // Buttons
  transactionDetailsButtonIndexSelector = 'button-transaction-details-';

  /* Selectors */
  viewContentsButtonSelector = 'button-view-file-contents';
  seeKeyDetailsButtonSelector = 'button-file-details-key';
  linkFileButtonSelector = 'button-file-details-link-file';
  fileAlreadyLinkedLabelSelector = 'p-file-details-file-already-linked';
  linkAccountButtonSelector = 'button-account-details-link-account';
  accountAlreadyLinkedLabelSelector = 'p-account-details-account-already-linked';
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
  historyTableHeaderSelector = 'css=.table-custom thead th span';
  historyDescriptionSortButtonSelector = 'css=.table-custom thead th:nth-child(3) .table-sort-link';
  historyDescriptionSortIconSelector = 'css=.table-custom thead th:nth-child(3) .table-sort-link i';
  firstHistoryDetailsButtonSelector = 'button-transaction-details-0';
  transactionStatusBadgeIndexSelector =
    'css=[data-testid="td-transaction-status-{index}"] span.badge';
  accountAlreadyLinkedTextSelector = 'text=Account already linked';
  historyRowsSelector = 'css=.table-custom tbody tr';

  constructor(window: Page) {
    super(window);
  }

  async clickOnFirstTransactionDetailsButton() {
    await this.click(this.firstHistoryDetailsButtonSelector, null, this.LONG_TIMEOUT);
  }

  async getFirstTransactionCreated(index = 0) {
    return await this.getText(this.transactionCreatedAtIndexSelector + index.toString());
  }

  async getFirstTransactionStatus(index = 0) {
    return await this.getText(this.transactionStatusIndexSelector + index.toString());
  }

  async getFirstTransactionType(index = 0) {
    return await this.getText(this.transactionTypeIndexSelector + index.toString());
  }

  async getFirstTransactionDescription(index = 0) {
    return await this.getText(this.transactionDescriptionIndexSelector + index.toString());
  }

  async getHistoryTableHeaderTexts() {
    const headers = await this.getText(this.historyTableHeaderSelector);
    return (headers ?? '').split(',').map(header => header.trim());
  }

  async sortHistoryByDescription() {
    await this.click(this.historyDescriptionSortButtonSelector, null, this.LONG_TIMEOUT);
  }

  async waitForHistoryDescriptionSortDirection(direction: 'asc' | 'desc') {
    const expectedClass = direction === 'asc' ? 'bi-arrow-up-short' : 'bi-arrow-down-short';
    await expect
      .poll(() =>
        this.getAttributeValue(
          this.historyDescriptionSortIconSelector,
          'class',
          null,
          this.SHORT_TIMEOUT,
        ),
      )
      .toContain(expectedClass);
  }

  async getTransactionStatusBadgeClass(index = 0) {
    return await this.getAttributeValue(
      this.getTransactionStatusBadgeSelector(index),
      'class',
      null,
      this.LONG_TIMEOUT,
    );
  }

  async isTransactionStatusBadgeSuccess(index = 0) {
    const className = await this.getTransactionStatusBadgeClass(index);
    return className?.includes('bg-success') === true && !className.includes('bg-danger');
  }

  async isTransactionStatusBadgeDanger(index = 0) {
    const className = await this.getTransactionStatusBadgeClass(index);
    return className?.includes('bg-danger') === true;
  }

  async isTransactionStatusBadgeDangerForTransaction(transactionId: string) {
    const rowCount = await this.getHistoryRowCount();

    for (let index = 0; index < rowCount; index++) {
      const currentTransactionId = await this.getText(
        this.transactionIdIndexSelector + index,
        null,
        this.SHORT_TIMEOUT,
      );

      if (currentTransactionId && transactionId.includes(currentTransactionId)) {
        return await this.isTransactionStatusBadgeDanger(index);
      }
    }

    return false;
  }

  async getFirstTransactionId(index = 0) {
    return await this.getText(this.transactionIdIndexSelector + index.toString());
  }

  async isTransactionDetailsButtonVisible(index = 0) {
    return this.isElementVisible(this.transactionDetailsButtonIndexSelector + index.toString());
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

  async isLinkFileButtonVisible() {
    return await this.isElementVisible(this.linkFileButtonSelector);
  }

  async clickOnLinkFileButton() {
    await this.click(this.linkFileButtonSelector);
  }

  async isFileAlreadyLinkedLabelVisible() {
    if (await this.isElementVisible(this.fileAlreadyLinkedLabelSelector)) {
      return true;
    }

    return await this.isElementVisible('text=File already linked', null, this.LONG_TIMEOUT);
  }

  async isLinkAccountButtonVisible() {
    return await this.isElementVisible(this.linkAccountButtonSelector);
  }

  async clickOnLinkAccountButton() {
    await this.click(this.linkAccountButtonSelector);
  }

  async isAccountAlreadyLinkedLabelVisible() {
    if (await this.isElementVisible(this.accountAlreadyLinkedLabelSelector)) {
      return true;
    }

    return await this.isElementVisible(
      this.accountAlreadyLinkedTextSelector,
      null,
      this.LONG_TIMEOUT,
    );
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
    index = 0,
  ) {
    const transactionId = await this.getFirstTransactionId(index);
    expect(expectedId.toString()).toContain(transactionId);

    const transactionType = await this.getFirstTransactionType(index);
    expect(transactionType).toBe(expectedType);

    if (expectedDescription) {
      const transactionDescription = await this.getFirstTransactionDescription(index);
      expect(transactionDescription).toBe(expectedDescription);
    }

    const transactionStatus = await this.getFirstTransactionStatus(index);
    expect(transactionStatus).toBe('SUCCESS');

    const transactionCreatedAt = await this.getFirstTransactionCreated(index);
    expect(transactionCreatedAt).toBeTruthy();

    const isTransactionDetailsButtonVisible = await this.isTransactionDetailsButtonVisible(index);
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

  async getHistoryDescriptionRowIndex(expectedDescription: string) {
    const rowCount = await this.getHistoryRowCount();

    for (let index = 0; index < rowCount; index++) {
      const currentDescription = await this.getFirstTransactionDescription(index);

      if (currentDescription?.trim() === expectedDescription) {
        return index;
      }
    }

    return -1;
  }

  async getBreadCrumbItem(index: number) {
    return this.getElement(`${this.breadCrumbItemSelector}${index}`);
  }

  private async getHistoryRowCount() {
    return await this.getElement(this.historyRowsSelector).count();
  }

  private getTransactionStatusBadgeSelector(index: number) {
    return this.transactionStatusBadgeIndexSelector.replace('{index}', index.toString());
  }
}
