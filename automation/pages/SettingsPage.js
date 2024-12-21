const BasePage = require('./BasePage');
const { queryDatabase } = require('../utils/databaseUtil');

class SettingsPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.currentIndex = '1';
  }

  /* Selectors */

  // Inputs
  indexInputSelector = 'input-index';
  nicknameInputSelector = 'input-nickname';
  ed25519PrivateKeyInputSelector = 'input-ed25519-private-key';
  ed25519PNicknameInputSelector = 'input-ed25519-private-key-nickname';
  ecdsaPrivateKeyInputSelector = 'input-ecdsa-private-key';
  ecdsaNicknameInputSelector = 'input-ecdsa-private-key-nickname';
  currentPasswordInputSelector = 'input-current-password';
  newPasswordInputSelector = 'input-new-password';
  defaultMaxTransactionFeeInputSelector = 'input-default-max-transaction-fee';
  keyPairNicknameInputSelector = 'input-key-pair-nickname';

  // Buttons
  settingsButtonSelector = 'button-menu-settings';
  generalTabButtonSelector = 'tab-0';
  organisationsTabButtonSelector = 'tab-1';
  keysTabButtonSelector = 'tab-2';
  profileTabButtonSelector = 'tab-3';
  mainnetTabButtonSelector = 'tab-network-mainnet';
  testnetTabButtonSelector = 'tab-network-testnet';
  previewnetTabButtonSelector = 'tab-network-previewnet';
  localNodeTabButtonSelector = 'tab-network-local-node';
  darkTabButtonSelector = 'tab-appearance-dark';
  lightTabButtonSelector = 'tab-appearance-light';
  systemTabButtonSelector = 'tab-appearance-system';
  restoreButtonSelector = 'button-restore';
  continueButtonSelector = 'button-continue';
  continueIndexButtonSelector = 'button-continue-index';
  continueNicknameButtonSelector = 'button-continue-nickname';
  continuePhraseButtonSelector = 'button-continue-phrase';
  importButtonSelector = 'button-restore-dropdown';
  ed25519ImportLinkSelector = 'link-import-ed25519-key';
  ecdsaImportLinkSelector = 'link-import-ecdsa-key';
  ed25519ImportButtonSelector = 'button-ed25519-private-key-import';
  ecdsaImportButtonSelector = 'button-ecdsa-private-key-import';
  decryptMainPrivateKeyButtonSelector = 'span-show-modal-0';
  deleteKeyPairButton = 'button-delete-keypair';
  deleteKeyButtonPrefix = 'button-delete-key-';
  changePasswordButtonSelector = 'button-change-password';
  confirmChangePasswordButtonSelector = 'button-confirm-change-password';
  closeButtonSelector = 'button-close';
  changeKeyNicknameButtonSelector = 'button-change-key-nickname';
  confirmNicknameChangeButtonSelector = 'button-confirm-update-nickname';

  // Text
  decryptedPrivateKeySelector = 'span-private-key-0';

  // Prefixes
  indexCellSelectorPrefix = 'cell-index-';
  nicknameCellSelectorPrefix = 'cell-nickname-';
  accountIdCellSelectorPrefix = 'cell-account-';
  keyTypeCellSelectorPrefix = 'cell-key-type-';
  publicKeyCellSelectorPrefix = 'span-public-key-';

  async verifySettingsElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.generalTabButtonSelector),
      this.isElementVisible(this.organisationsTabButtonSelector),
      this.isElementVisible(this.keysTabButtonSelector),
      this.isElementVisible(this.profileTabButtonSelector),
      this.isElementVisible(this.mainnetTabButtonSelector),
      this.isElementVisible(this.testnetTabButtonSelector),
      this.isElementVisible(this.previewnetTabButtonSelector),
      this.isElementVisible(this.localNodeTabButtonSelector),
      this.isElementVisible(this.darkTabButtonSelector),
      this.isElementVisible(this.lightTabButtonSelector),
      this.isElementVisible(this.systemTabButtonSelector),
    ]);

    return checks.every(isTrue => isTrue);
  }

  async incrementIndex() {
    let numericValue = parseInt(this.currentIndex);
    numericValue++;
    this.currentIndex = numericValue.toString();
  }

  async decrementIndex() {
    let numericValue = parseInt(this.currentIndex);
    numericValue--;
    this.currentIndex = numericValue.toString();
  }

  // Function to verify keys exist for a given index and user's email
  async verifyKeysExistByIndexAndEmail(email, index) {
    const query = `
      SELECT public_key, private_key
      FROM KeyPair kp
      JOIN User u ON u.id = kp.user_id
      WHERE u.email = ? AND kp."index" = ?`;

    try {
      const row = await queryDatabase(query, [email, index]);
      return row !== undefined && row.public_key !== undefined && row.private_key !== undefined;
    } catch (error) {
      console.error('Error verifying keys for index:', error);
      return false;
    }
  }

  async getKeyRowCount() {
    return await this.countElements(this.indexCellSelectorPrefix);
  }

  async getRowDataByIndex(index) {
    return {
      index: await this.getText(this.indexCellSelectorPrefix + index),
      nickname: await this.getText(this.nicknameCellSelectorPrefix + index),
      accountID: await this.getText(this.accountIdCellSelectorPrefix + index),
      keyType: await this.getText(this.keyTypeCellSelectorPrefix + index),
      publicKey: await this.getText(this.publicKeyCellSelectorPrefix + index),
    };
  }

  async clickOnSettingsButton() {
    await this.click(this.settingsButtonSelector);
  }

  async clickOnKeysTab() {
    await this.click(this.keysTabButtonSelector);
  }

  async clickOnProfileTab() {
    await this.click(this.profileTabButtonSelector);
  }

  async clickOnRestoreButton() {
    const maxRetries = 10;
    let attempt = 0;

    while (attempt < maxRetries) {
      await this.click(this.restoreButtonSelector);
      if (await this.isElementVisible(this.continuePhraseButtonSelector, null, 3000)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempt++;
    }

    throw new Error(
      `Failed to click on restore button and see continue button after ${maxRetries} attempts`,
    );
  }

  async clickOnContinueButton() {
    await this.click(this.continueButtonSelector, null, 25000);
  }

  async fillInIndex(index = 1) {
    await this.fill(this.indexInputSelector, index);
  }

  async clickOnIndexContinueButton() {
    await this.click(this.continueIndexButtonSelector);
  }

  async fillInNickname(nickname) {
    await this.fill(this.nicknameInputSelector, nickname);
  }

  async clickOnNicknameContinueButton() {
    await this.click(this.continueNicknameButtonSelector, null, 12000);
  }

  async clickOnContinuePhraseButton() {
    await this.click(this.continuePhraseButtonSelector);
  }

  async clickOnLocalNodeTab() {
    await this.click(this.localNodeTabButtonSelector);
  }

  async clickOnImportButton() {
    await this.click(this.importButtonSelector);
  }

  async clickOnECDSADropDown() {
    await this.click(this.ecdsaImportLinkSelector);
  }

  async clickOnED25519DropDown() {
    await this.click(this.ed25519ImportLinkSelector);
  }

  async fillInECDSAPrivateKey(ecdsaPrivateKey) {
    await this.fill(this.ecdsaPrivateKeyInputSelector, ecdsaPrivateKey);
  }

  async fillInED25519PrivateKey(ecdsaPrivateKey) {
    await this.fill(this.ed25519PrivateKeyInputSelector, ecdsaPrivateKey);
  }

  async fillInECDSANickname(ecdsaNickname) {
    await this.fill(this.ecdsaNicknameInputSelector, ecdsaNickname);
  }

  async fillInED25519Nickname(ecdsaNickname) {
    await this.fill(this.ed25519PNicknameInputSelector, ecdsaNickname);
  }

  async clickOnECDSAImportButton() {
    await this.click(this.ecdsaImportButtonSelector);
  }

  async clickOnED25519ImportButton() {
    await this.click(this.ed25519ImportButtonSelector);
  }

  async clickOnEyeDecryptIcon() {
    await this.click(this.decryptMainPrivateKeyButtonSelector);
  }

  async getPrivateKeyText() {
    return await this.getText(this.decryptedPrivateKeySelector);
  }

  async clickOnDeleteButtonAtIndex(index) {
    await this.click(this.deleteKeyButtonPrefix + index);
  }

  async clickOnDeleteKeyPairButton() {
    await this.click(this.deleteKeyPairButton);
  }

  async fillInCurrentPassword(password) {
    await this.fill(this.currentPasswordInputSelector, password);
  }

  async fillInNewPassword(password) {
    await this.fill(this.newPasswordInputSelector, password);
  }

  async clickOnChangePasswordButton() {
    await this.click(this.changePasswordButtonSelector);
  }

  async clickOnConfirmChangePassword() {
    await this.click(this.confirmChangePasswordButtonSelector);
  }

  async clickOnCloseButton() {
    await this.waitForElementToBeVisible(this.closeButtonSelector, 15000);
    await this.click(this.closeButtonSelector);
  }

  async clickOnOrganisationsTab() {
    await this.click(this.organisationsTabButtonSelector);
  }

  async fillInDefaultMaxTransactionFee(fee) {
    await this.fill(this.defaultMaxTransactionFeeInputSelector, fee);
  }

  async clickOnChangeKeyNicknameButton(index) {
    await this.click(this.changeKeyNicknameButtonSelector, 0);
  }

  async clickOnConfirmNicknameChangeButton() {
    await this.click(this.confirmNicknameChangeButtonSelector);
  }

  async fillInKeyPairNickname(nickname) {
    await this.fill(this.keyPairNicknameInputSelector, nickname);
  }

  async changeNicknameForFirstKey(nickname) {
    await this.clickOnChangeKeyNicknameButton(0);
    await this.fillInKeyPairNickname(nickname);
    await this.clickOnConfirmNicknameChangeButton();
  }
}
module.exports = SettingsPage;
