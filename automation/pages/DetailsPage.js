const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');
const { expect } = require('playwright/test');
import { allure } from 'allure-playwright';

class DetailsPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.transactionPage = new TransactionPage(window);
  }

  /* Selectors */
  transactionDetailsButtonIndexSelector = 'button-transaction-details-';
  viewContentsButtonSelector = 'button-view-file-contents';
  seeKeyDetailsButtonSelector = 'button-file-details-key';

  transactionCreatedAtIndexSelector = 'td-transaction-createdAt-';
  transactionStatusIndexSelector = 'td-transaction-status-';
  transactionTypeIndexSelector = 'td-transaction-type-';
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
  accountDetailsDeclineRewardsSelector = 'p-account-details-decline-rewards';
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
  fileDetailsKeyTextSelector = 'p-file-details-key-text';

  async clickOnFirstTransactionDetailsButton() {
    await allure.step('Click on First Transaction Details Button', async () => {
      await this.clickByTestId(this.transactionDetailsButtonIndexSelector + '0');
    });
  }

  async getFirstTransactionCreated() {
    return allure.step('Get First Transaction Created', async () => {
      return await this.getTextByTestId(this.transactionCreatedAtIndexSelector + '0');
    });
  }

  async getFirstTransactionStatus() {
    return allure.step('Get First Transaction Status', async () => {
      return await this.getTextByTestId(this.transactionStatusIndexSelector + '0');
    });
  }

  async getFirstTransactionType() {
    return allure.step('Get First Transaction Type', async () => {
      return await this.getTextByTestId(this.transactionTypeIndexSelector + '0');
    });
  }

  async getFirstTransactionId() {
    return allure.step('Get First Transaction ID', async () => {
      return await this.getTextByTestId(this.transactionIdIndexSelector + '0');
    });
  }

  async isTransactionDetailsButtonVisible() {
    return allure.step('Check if Transaction Details Button is Visible', async () => {
      return this.isElementVisible(this.transactionDetailsButtonIndexSelector + '0');
    });
  }

  async getTransactionDetailsType() {
    return allure.step('Get Transaction Details Type', async () => {
      return await this.getTextByTestId(this.transactionDetailsTypeSelector);
    });
  }

  async getTransactionDetailsId() {
    return allure.step('Get Transaction Details ID', async () => {
      return await this.getTextByTestId(this.transactionDetailsIdSelector);
    });
  }

  async getTransactionDetailsCreatedAt() {
    return allure.step('Get Transaction Details Created At', async () => {
      return await this.getTextByTestId(this.transactionDetailsCreatedAtSelector);
    });
  }

  async getTransactionDetailsExecutedAt() {
    return allure.step('Get Transaction Details Executed At', async () => {
      return await this.getTextByTestId(this.transactionDetailsExecutedAtSelector);
    });
  }

  async getValidStart() {
    return allure.step('Get Valid Start', async () => {
      return await this.getTextByTestId(this.transactionDetailsValidStartSelector);
    });
  }

  async getTransactionDetailsFeePayer() {
    return allure.step('Get Transaction Details Fee Payer', async () => {
      return await this.getTextByTestId(this.transactionDetailsFeePayerSelector);
    });
  }

  async getTransactionDetailsMemo() {
    return allure.step('Get Transaction Details Memo', async () => {
      return await this.getTextByTestId(this.transactionDetailsMemoSelector);
    });
  }

  async getAccountUpdateDetailsId() {
    return allure.step('Get Account Update Details ID', async () => {
      return await this.getTextByTestId(this.accountUpdateDetailsIdSelector);
    });
  }

  async getAccountDetailsKey() {
    return allure.step('Get Account Details Key', async () => {
      return await this.getTextByTestId(this.accountDetailsKeySelector);
    });
  }

  async getAccountDetailsMemo() {
    return allure.step('Get Account Details Memo', async () => {
      return await this.getTextByTestId(this.accountDetailsMemoSelector);
    });
  }

  async getAccountDetailsStaking() {
    return allure.step('Get Account Details Staking', async () => {
      return await this.getTextByTestId(this.accountDetailsStakingSelector);
    });
  }

  async getAccountDetailsDeclineRewards() {
    return allure.step('Get Account Details Decline Rewards', async () => {
      return await this.getTextByTestId(this.accountDetailsDeclineRewardsSelector);
    });
  }

  async getAccountDetailsReceiverSigRequired() {
    return allure.step('Get Account Details Receiver Sig Required', async () => {
      return await this.getTextByTestId(this.accountDetailsReceiverSigRequiredSelector);
    });
  }

  async getAccountDetailsInitBalance() {
    return allure.step('Get Account Details Init Balance', async () => {
      return await this.getTextByTestId(this.accountDetailsInitBalanceSelector);
    });
  }

  async getDeletedAccountId() {
    return allure.step('Get Deleted Account ID', async () => {
      return await this.getTextByTestId(this.accountDeleteDetailsDeletedAccountIdSelector);
    });
  }

  async getAccountDeleteDetailsTransferId() {
    return allure.step('Get Account Delete Details Transfer ID', async () => {
      return await this.getTextByTestId(this.accountDeleteDetailsTransferIdSelector);
    });
  }

  async getTransferDetailsFromAccount() {
    return allure.step('Get Transfer Details From Account', async () => {
      return await this.getTextByTestId(this.transferDetailsFromAccountSelector);
    });
  }

  async getTransferDetailsFromAmount() {
    return allure.step('Get Transfer Details From Amount', async () => {
      return await this.getTextByTestId(this.transferDetailsFromAmountSelector);
    });
  }

  async getTransferDetailsToAccount() {
    return allure.step('Get Transfer Details To Account', async () => {
      return await this.getTextByTestId(this.transferDetailsToAccountSelector);
    });
  }

  async getTransferDetailsToAmount() {
    return allure.step('Get Transfer Details To Amount', async () => {
      return await this.getTextByTestId(this.transferDetailsToAmountSelector);
    });
  }

  async getAllowanceDetailsOwnerAccount() {
    return allure.step('Get Allowance Details Owner Account', async () => {
      return await this.getTextByTestId(this.allowanceDetailsOwnerAccountSelector);
    });
  }

  async getAllowanceDetailsSpenderAccount() {
    return allure.step('Get Allowance Details Spender Account', async () => {
      return await this.getTextByTestId(this.allowanceDetailsSpenderAccountSelector);
    });
  }

  async getAllowanceDetailsAmount() {
    return allure.step('Get Allowance Details Amount', async () => {
      return await this.getTextByTestId(this.allowanceDetailsAmountSelector);
    });
  }

  async isViewContentsButtonVisible() {
    return allure.step('Check if View Contents Button is Visible', async () => {
      return await this.isElementVisible(this.viewContentsButtonSelector);
    });
  }

  async isSeeKeyDetailsButtonVisible() {
    return allure.step('Check if See Key Details Button is Visible', async () => {
      return await this.isElementVisible(this.seeKeyDetailsButtonSelector);
    });
  }

  async getFileDetailsExpirationTime() {
    return allure.step('Get File Details Expiration Time', async () => {
      return await this.getTextByTestId(this.fileDetailsExpirationTimeSelector);
    });
  }

  async getFileDetailsFileId() {
    return allure.step('Get File Details File ID', async () => {
      return await this.getTextByTestId(this.fileDetailsFileIdSelector);
    });
  }

  async getFileDetailsKeyText() {
    return allure.step('Get File Details Key Text', async () => {
      return await this.getTextByTestId(this.fileDetailsKeyTextSelector);
    });
  }

  async assertTransactionDisplayed(expectedId, expectedType) {
    await allure.step('Assert Transaction Displayed', async () => {
      const transactionId = await this.getFirstTransactionId();
      expect(expectedId.toString()).toContain(transactionId);

      const transactionType = await this.getFirstTransactionType();
      expect(transactionType).toBe(expectedType);

      const transactionStatus = await this.getFirstTransactionStatus();
      expect(transactionStatus).toBe('SUCCESS');

      const transactionCreatedAt = await this.getFirstTransactionCreated();
      expect(transactionCreatedAt).toBeTruthy();

      const isTransactionDetailsButtonVisible = await this.isTransactionDetailsButtonVisible();
      expect(isTransactionDetailsButtonVisible).toBe(true);
    });
  }

  async assertTransactionDetails(expectedId, expectedType, extraAssertions = () => {}) {
    await allure.step('Assert Transaction Details', async () => {
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

      await extraAssertions();
    });
  }
}

module.exports = DetailsPage;
