const BasePage = require('./BasePage');
const TransactionPage = require('./TransactionPage');
import { allure } from 'allure-playwright';

class AccountPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.unlikedAccounts = []; // Store unliked accounts
    this.transactionPage = new TransactionPage(window);
  }

  /* Selectors */
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
  selectManyAccountsButtonSelector = 'button-select-many-accounts';

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

  existingAccountIdInputSelector = 'input-existing-account-id';
  multiSelectCheckboxSelector = 'checkbox-multiple-account-id-';

  async clickOnEditButton() {
    await allure.step('Click on Edit Button', async () => {
      await this.clickByTestId(this.editButtonSelector);
    });
  }

  async clickOnRemoveButton() {
    await allure.step('Click on Remove Button', async () => {
      await this.clickByTestId(this.removeButtonSelector);
    });
  }

  async clickOnAddNewButton() {
    await allure.step('Click on Add New Button', async () => {
      const { delay } = await import('../utils/util.js');
      await delay(500);
      await this.clickByTestId(this.addNewButtonSelector);
      await delay(500);
    });
  }

  async clickOnCreateNewLink() {
    return allure.step('Click on Create New Link', async () => {
      await this.clickByTestId(this.createNewLinkSelector);
    });
  }

  async clickOnAddExistingLink() {
    return allure.step('Click on Add Existing Link', async () => {
      await this.clickByTestId(this.addExistingLinkSelector);
    });
  }

  async clickOnAccountsLink() {
    await allure.step('Click on Accounts Link', async () => {
      await this.clickByTestId(this.accountsLinkSelector);
    });
  }

  async getAccountIdText() {
    return allure.step('Get Account ID Text', async () => {
      return await this.getTextByTestId(this.accountIdTextSelector);
    });
  }

  async getEvmAddressText() {
    return allure.step('Get EVM Address Text', async () => {
      return await this.getTextByTestId(this.evmAddressTextSelector);
    });
  }

  async getBalanceText() {
    return allure.step('Get Balance Text', async () => {
      return await this.getTextByTestId(this.balanceTextSelector);
    });
  }

  async getKeyText() {
    return allure.step('Get Key Text', async () => {
      return await this.getTextByTestId(this.keyTextSelector);
    });
  }

  async getKeyTypeText() {
    return allure.step('Get Key Type Text', async () => {
      return await this.getTextByTestId(this.keyTypeTextSelector);
    });
  }

  async getReceiverSigRequiredText() {
    return allure.step('Get Receiver Sig Required Text', async () => {
      return await this.getTextByTestId(this.receiverSigRequiredTextSelector);
    });
  }

  async getMemoText() {
    return allure.step('Get Memo Text', async () => {
      return await this.getTextByTestId(this.memoTextSelector);
    });
  }

  async getMaxAutoAssocText() {
    return allure.step('Get Max Auto Association Text', async () => {
      return await this.getTextByTestId(this.maxAutoAssocTextSelector);
    });
  }

  async getEthereumNonceText() {
    return allure.step('Get Ethereum Nonce Text', async () => {
      return await this.getTextByTestId(this.ethereumNonceTextSelector);
    });
  }

  async getCreatedAtText() {
    return allure.step('Get Created At Text', async () => {
      return await this.getTextByTestId(this.createdAtTextSelector);
    });
  }

  async getExpiresAtText() {
    return allure.step('Get Expires At Text', async () => {
      return await this.getTextByTestId(this.expiresAtTextSelector);
    });
  }

  async getAutoRenewPeriodText() {
    return allure.step('Get Auto Renew Period Text', async () => {
      return await this.getTextByTestId(this.autoRenewPeriodTextSelector);
    });
  }

  async getStakedToText() {
    return allure.step('Get Staked To Text', async () => {
      return await this.getTextByTestId(this.stakedToTextSelector);
    });
  }

  async getPendingRewardText() {
    return allure.step('Get Pending Reward Text', async () => {
      return await this.getTextByTestId(this.pendingRewardTextSelector);
    });
  }

  async getRewardsText() {
    return allure.step('Get Rewards Text', async () => {
      return await this.getTextByTestId(this.rewardsTextSelector);
    });
  }

  async clickOnDeleteFromNetworkLink() {
    await allure.step('Click on Delete From Network Link', async () => {
      await this.clickByTestId(this.deleteFromNetworkLinkSelector);
    });
  }

  async clickOnUpdateInNetworkLink() {
    await allure.step('Click on Update In Network Link', async () => {
      await this.clickByTestId(this.updateInNetworkLinkSelector);
    });
  }

  async addAccountToUnliked(accountId) {
    return allure.step('Add Account To Unliked', async () => {
      this.unlikedAccounts.push(accountId);
    });
  }

  async unlinkAccounts() {
    await allure.step('Unlink Accounts', async () => {
      await this.waitForElementToBeVisible(this.confirmUnlinkButtonSelector);
      await this.clickByTestId(this.confirmUnlinkButtonSelector);
    });
  }

  async fillInExistingAccountId(accountId) {
    await allure.step('Fill In Existing Account ID', async () => {
      await this.fillByTestId(this.existingAccountIdInputSelector, accountId);
    });
  }

  async clickOnLinkAccountButton() {
    await allure.step('Click on Link Account Button', async () => {
      await this.clickByTestId(this.linkAccountButtonSelector);
    });
  }

  async isUnlinkedAccountsListEmpty() {
    return allure.step('Check if Unlinked Accounts List is Empty', async () => {
      return this.unlikedAccounts.length === 0;
    });
  }

  async getFirstAccountFromUnlinkedList() {
    return allure.step('Get First Account From Unlinked List', async () => {
      return this.unlikedAccounts[0];
    });
  }

  async ensureAccountExistsAndUnlinked(password) {
    await allure.step('Ensure Account Exists and Unlinked', async () => {
      if (await this.isUnlinkedAccountsListEmpty()) {
        const { newAccountId } = await this.transactionPage.createNewAccount(password);
        await this.transactionPage.mirrorGetAccountResponse(newAccountId);
        await this.transactionPage.clickOnTransactionsMenuButton();
        await this.clickOnAccountsLink();
        await this.clickOnRemoveButton();
        await this.unlinkAccounts(newAccountId);
        await this.addAccountToUnliked(newAccountId);
      }
    });
  }

  async clickOnAccountCheckbox(accountId) {
    await allure.step('Click on Account Checkbox', async () => {
      const { delay } = await import('../utils/util.js');
      await delay(1000);
      const index = await this.transactionPage.findAccountIndexById(accountId);
      await this.clickByTestId(this.multiSelectCheckboxSelector + index);
    });
  }

  async clickOnSelectManyAccountsButton() {
    await allure.step('Click on Select Many Accounts Button', async () => {
      await this.clickByTestId(this.selectManyAccountsButtonSelector);
    });
  }
}

module.exports = AccountPage;
