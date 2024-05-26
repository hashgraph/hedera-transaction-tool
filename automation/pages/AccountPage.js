const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');

class AccountPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.unlikedAccounts = []; // Store unliked accounts
    this.transactionPage = new TransactionPage(window);
  }

  /* Selectors */

  // Buttons
  editButtonSelector = 'button-edit-account';
  removeButtonSelector = 'button-remove-account-card';
  addNewButtonSelector = 'button-add-new-account';
  createNewLinkSelector = 'link-create-new-account';
  addExistingLinkSelector = 'link-add-existing-account';
  accountsLinkSelector = 'button-menu-accounts';
  deleteFromNetworkLinkSelector = 'button-delete-from-network';
  updateInNetworkLinkSelector = 'button-update-in-network';
  confirmUnlinkButtonSelector = 'button-confirm-unlink-account';
  linkAccountButtonSelector = 'button-link-account-id';

  // Texts
  accountIdTextSelector = 'p-account-data-account-id';
  evmAddressTextSelector = 'p-account-data-evm-address';
  balanceTextSelector = 'p-account-data-balance';
  keyTextSelector = 'p-account-data-key';
  keyTypeTextSelector = 'p-account-data-key-type';
  receiverSigRequiredTextSelector = 'p-account-data-receiver-sig-required';
  memoTextSelector = 'p-account-data-memo';
  maxAutoAssocTextSelector = 'p-account-data-max-auto-association';
  ethereumNonceTextSelector = 'p-account-data-eth-nonce';
  createdAtTextSelector = 'p-account-data-created-at';
  expiresAtTextSelector = 'p-account-data-expires-at';
  autoRenewPeriodTextSelector = 'p-account-data-auto-renew-period';
  stakedToTextSelector = 'p-account-data-staked-to';
  pendingRewardTextSelector = 'p-account-data-pending-reward';
  rewardsTextSelector = 'p-account-data-rewards';

  // Inputs
  existingAccountIdInputSelector = 'input-existing-account-id';

  async clickOnEditButton() {
    await this.clickByTestId(this.editButtonSelector);
  }

  async clickOnRemoveButton() {
    await this.clickByTestId(this.removeButtonSelector);
  }

  async clickOnAddNewButton() {
    await this.clickByTestId(this.addNewButtonSelector);
  }

  async clickOnCreateNewLink() {
    await this.clickByTestId(this.createNewLinkSelector);
  }

  async clickOnAddExistingLink() {
    await this.clickByTestId(this.addExistingLinkSelector);
  }

  async clickOnAccountsLink() {
    await this.clickByTestId(this.accountsLinkSelector);
  }

  async getAccountIdText() {
    return await this.getTextByTestId(this.accountIdTextSelector);
  }

  async getEvmAddressText() {
    return await this.getTextByTestId(this.evmAddressTextSelector);
  }

  async getBalanceText() {
    return await this.getTextByTestId(this.balanceTextSelector);
  }

  async getKeyText() {
    return await this.getTextByTestId(this.keyTextSelector);
  }

  async getKeyTypeText() {
    return await this.getTextByTestId(this.keyTypeTextSelector);
  }

  async getReceiverSigRequiredText() {
    return await this.getTextByTestId(this.receiverSigRequiredTextSelector);
  }

  async getMemoText() {
    return await this.getTextByTestId(this.memoTextSelector);
  }

  async getMaxAutoAssocText() {
    return await this.getTextByTestId(this.maxAutoAssocTextSelector);
  }

  async getEthereumNonceText() {
    return await this.getTextByTestId(this.ethereumNonceTextSelector);
  }

  async getCreatedAtText() {
    return await this.getTextByTestId(this.createdAtTextSelector);
  }

  async getExpiresAtText() {
    return await this.getTextByTestId(this.expiresAtTextSelector);
  }

  async getAutoRenewPeriodText() {
    return await this.getTextByTestId(this.autoRenewPeriodTextSelector);
  }

  async getStakedToText() {
    return await this.getTextByTestId(this.stakedToTextSelector);
  }

  async getPendingRewardText() {
    return await this.getTextByTestId(this.pendingRewardTextSelector);
  }

  async getRewardsText() {
    return await this.getTextByTestId(this.rewardsTextSelector);
  }

  async clickOnDeleteFromNetworkLink() {
    await this.clickByTestId(this.deleteFromNetworkLinkSelector);
  }

  async clickOnUpdateInNetworkLink() {
    await this.clickByTestId(this.updateInNetworkLinkSelector);
  }

  async addAccountToUnliked(accountId) {
    this.unlikedAccounts.push(accountId);
  }

  async unlinkAccounts(accountId) {
    await this.waitForElementToBeVisible(this.confirmUnlinkButtonSelector);
    await this.clickByTestId(this.confirmUnlinkButtonSelector);
    await this.addAccountToUnliked(accountId);
  }

  async fillInExistingAccountId(accountId) {
    await this.fillByTestId(this.existingAccountIdInputSelector, accountId);
  }

  async clickOnLinkAccountButton() {
    await this.clickByTestId(this.linkAccountButtonSelector);
  }

  async isUnlinkedAccountsListEmpty() {
    return this.unlikedAccounts.length === 0;
  }

  async getFirstAccountFromUnlinkedList() {
    return this.unlikedAccounts[0];
  }

  async ensureAccountExistsAndUnlinked(password) {
    if (await this.isUnlinkedAccountsListEmpty()) {
      const { newAccountId } = await this.transactionPage.createNewAccount(password);
      await this.transactionPage.mirrorGetAccountResponse(newAccountId);
      await this.transactionPage.clickOnTransactionsMenuButton();
      await this.clickOnAccountsLink();
      await this.clickOnRemoveButton();
      await this.unlinkAccounts(newAccountId);
    }
  }
}

module.exports = AccountPage;
