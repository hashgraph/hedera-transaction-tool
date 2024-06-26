const BasePage = require('./BasePage');
const { queryDatabase } = require('../utils/databaseUtil');
import { allure } from 'allure-playwright';

class SettingsPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.currentIndex = '1';
  }

  /* Selectors */
  nodeAccountidInputSelector = 'input-node-accountid';
  passwordInputSelector = 'input-password';
  indexInputSelector = 'input-index';
  nicknameInputSelector = 'input-nickname';
  ed25519PrivateKeyInputSelector = 'input-ed25519-private-key';
  ed25519PNicknameInputSelector = 'input-ed25519-private-key-nickname';
  ed25519PasswordInputSelector = 'input-ed25519-private-key-password';
  ecdsaPrivateKeyInputSelector = 'input-ecdsa-private-key';
  ecdsaNicknameInputSelector = 'input-ecdsa-private-key-nickname';
  ecdsaPasswordInputSelector = 'input-ecdsa-private-key-password';
  decryptPasswordInputSelector = 'input-decrypt-password';
  currentPasswordInputSelector = 'input-current-password';
  newPasswordInputSelector = 'input-new-password';

  settingsButtonSelector = 'button-menu-settings';
  generalTabButtonSelector = 'tab-0';
  organisationsTabButtonSelector = 'tab-1';
  keysTabButtonSelector = 'tab-2';
  profileTabButtonSelector = 'tab-3';
  mainnetTabButtonSelector = 'tab-network-mainnet';
  testnetTabButtonSelector = 'tab-network-testnet';
  previewnetTabButtonSelector = 'tab-network-previewnet';
  customTabButtonSelector = 'tab-network-custom';
  darkTabButtonSelector = 'tab-appearance-dark';
  lightTabButtonSelector = 'tab-appearance-light';
  systemTabButtonSelector = 'tab-appearance-system';
  restoreButtonSelector = 'button-restore';
  continueButtonSelector = 'button-continue';
  continuePasswordButtonSelector = 'button-continue-password';
  continueIndexButtonSelector = 'button-continue-index';
  continueNicknameButtonSelector = 'button-continue-nickname';
  continuePhraseButtonSelector = 'button-continue-phrase';
  importButtonSelector = 'button-restore-dropdown';
  ed25519ImportLinkSelector = 'link-import-ed25519-key';
  ecdsaImportLinkSelector = 'link-import-ecdsa-key';
  ed25519ImportButtonSelector = 'button-ed25519-private-key-import';
  ecdsaImportButtonSelector = 'button-ecdsa-private-key-import';
  decryptMainPrivateKeyButtonSelector = 'span-show-modal-0';
  decryptPasswordButtonSelector = 'button-decrypt';
  deleteKeyPairButton = 'button-delete-keypair';
  deleteKeyButtonPrefix = 'button-delete-key-';
  changePasswordButtonSelector = 'button-change-password';
  confirmChangePasswordButtonSelector = 'button-confirm-change-password';
  closeButtonSelector = 'button-close';

  decryptedPrivateKeySelector = 'span-private-key-0';

  indexCellSelectorPrefix = 'cell-index-';
  nicknameCellSelectorPrefix = 'cell-nickname-';
  accountIdCellSelectorPrefix = 'cell-account-';
  keyTypeCellSelectorPrefix = 'cell-key-type-';
  publicKeyCellSelectorPrefix = 'span-public-key-';

  async verifySettingsElements() {
    return allure.step('Verify Settings Elements', async () => {
      const checks = await Promise.all([
        this.isElementVisible(this.generalTabButtonSelector),
        this.isElementVisible(this.organisationsTabButtonSelector),
        this.isElementVisible(this.keysTabButtonSelector),
        this.isElementVisible(this.profileTabButtonSelector),
        this.isElementVisible(this.mainnetTabButtonSelector),
        this.isElementVisible(this.testnetTabButtonSelector),
        this.isElementVisible(this.previewnetTabButtonSelector),
        this.isElementVisible(this.customTabButtonSelector),
        this.isElementVisible(this.darkTabButtonSelector),
        this.isElementVisible(this.lightTabButtonSelector),
        this.isElementVisible(this.systemTabButtonSelector),
      ]);

      return checks.every(isTrue => isTrue);
    });
  }

  async incrementIndex() {
    await allure.step('Increment Index', async () => {
      let numericValue = parseInt(this.currentIndex);
      numericValue++;
      this.currentIndex = numericValue.toString();
    });
  }

  async decrementIndex() {
    await allure.step('Decrement Index', async () => {
      let numericValue = parseInt(this.currentIndex);
      numericValue--;
      this.currentIndex = numericValue.toString();
    });
  }

  async verifyKeysExistByIndexAndEmail(email, index) {
    return allure.step('Verify Keys Exist by Index and Email', async () => {
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
    });
  }

  async getKeyRowCount() {
    return allure.step('Get Key Row Count', async () => {
      return await this.countElementsByTestId(this.indexCellSelectorPrefix);
    });
  }

  async getRowDataByIndex(index) {
    return allure.step('Get Row Data by Index', async () => {
      return {
        index: await this.getTextByTestId(this.indexCellSelectorPrefix + index),
        nickname: await this.getTextByTestId(this.nicknameCellSelectorPrefix + index),
        accountID: await this.getTextByTestId(this.accountIdCellSelectorPrefix + index),
        keyType: await this.getTextByTestId(this.keyTypeCellSelectorPrefix + index),
        publicKey: await this.getTextByTestId(this.publicKeyCellSelectorPrefix + index),
      };
    });
  }

  async clickOnSettingsButton() {
    await allure.step('Click on Settings Button', async () => {
      await this.clickByTestId(this.settingsButtonSelector);
    });
  }

  async clickOnKeysTab() {
    await allure.step('Click on Keys Tab', async () => {
      await this.clickByTestId(this.keysTabButtonSelector);
    });
  }

  async clickOnProfileTab() {
    await allure.step('Click on Profile Tab', async () => {
      await this.clickByTestId(this.profileTabButtonSelector);
    });
  }

  async clickOnRestoreButton() {
    await allure.step('Click on Restore Button', async () => {
      const { delay } = require('../utils/util.js');
      const maxRetries = 10;
      let attempt = 0;

      while (attempt < maxRetries) {
        await this.clickByTestId(this.restoreButtonSelector);
        if (await this.isElementVisible(this.continueButtonSelector, 3000)) {
          return;
        }
        await delay(2000);
        attempt++;
      }

      throw new Error(
        `Failed to click on restore button and see continue button after ${maxRetries} attempts`,
      );
    });
  }

  async clickOnContinueButton() {
    await allure.step('Click on Continue Button', async () => {
      await this.clickByTestId(this.continueButtonSelector, 25000);
    });
  }

  async fillInPassword(password) {
    await allure.step('Fill in Password', async () => {
      await this.fillByTestId(this.passwordInputSelector, password);
    });
  }

  async clickOnPasswordContinueButton() {
    await allure.step('Click on Password Continue Button', async () => {
      await this.clickByTestId(this.continuePasswordButtonSelector);
    });
  }

  async fillInIndex(index = 1) {
    await allure.step('Fill in Index', async () => {
      await this.fillByTestId(this.indexInputSelector, index);
    });
  }

  async clickOnIndexContinueButton() {
    await allure.step('Click on Index Continue Button', async () => {
      await this.clickByTestId(this.continueIndexButtonSelector);
    });
  }

  async fillInNickname(nickname) {
    await allure.step('Fill in Nickname', async () => {
      await this.fillByTestId(this.nicknameInputSelector, nickname);
    });
  }

  async clickOnNicknameContinueButton() {
    await allure.step('Click on Nickname Continue Button', async () => {
      await this.clickByTestId(this.continueNicknameButtonSelector, 12000);
    });
  }

  async clickOnContinuePhraseButton() {
    await allure.step('Click on Continue Phrase Button', async () => {
      await this.clickByTestId(this.continuePhraseButtonSelector);
    });
  }

  async clickOnCustomTab() {
    await allure.step('Click on Custom Tab', async () => {
      await this.clickByTestId(this.customTabButtonSelector);
    });
  }

  async clickOnImportButton() {
    await allure.step('Click on Import Button', async () => {
      await this.clickByTestId(this.importButtonSelector);
    });
  }

  async clickOnECDSADropDown() {
    await allure.step('Click on ECDSA Drop Down', async () => {
      await this.clickByTestId(this.ecdsaImportLinkSelector);
    });
  }

  async clickOnED25519DropDown() {
    await allure.step('Click on ED25519 Drop Down', async () => {
      await this.clickByTestId(this.ed25519ImportLinkSelector);
    });
  }

  async fillInECDSAPrivateKey(ecdsaPrivateKey) {
    await allure.step('Fill in ECDSA Private Key', async () => {
      await this.fillByTestId(this.ecdsaPrivateKeyInputSelector, ecdsaPrivateKey);
    });
  }

  async fillInED25519PrivateKey(ecdsaPrivateKey) {
    await allure.step('Fill in ED25519 Private Key', async () => {
      await this.fillByTestId(this.ed25519PrivateKeyInputSelector, ecdsaPrivateKey);
    });
  }

  async fillInECDSANickname(ecdsaNickname) {
    await allure.step('Fill in ECDSA Nickname', async () => {
      await this.fillByTestId(this.ecdsaNicknameInputSelector, ecdsaNickname);
    });
  }

  async fillInED25519Nickname(ecdsaNickname) {
    await allure.step('Fill in ED25519 Nickname', async () => {
      await this.fillByTestId(this.ed25519PNicknameInputSelector, ecdsaNickname);
    });
  }

  async fillInECDSAPassword(password) {
    await allure.step('Fill in ECDSA Password', async () => {
      await this.fillByTestId(this.ecdsaPasswordInputSelector, password);
    });
  }

  async fillInED25519Password(password) {
    await allure.step('Fill in ED25519 Password', async () => {
      await this.fillByTestId(this.ed25519PasswordInputSelector, password);
    });
  }

  async clickOnECDSAImportButton() {
    await allure.step('Click on ECDSA Import Button', async () => {
      await this.clickByTestId(this.ecdsaImportButtonSelector);
    });
  }

  async clickOnED25519ImportButton() {
    await allure.step('Click on ED25519 Import Button', async () => {
      await this.clickByTestId(this.ed25519ImportButtonSelector);
    });
  }

  async clickOnEyeDecryptIcon() {
    await allure.step('Click on Eye Decrypt Icon', async () => {
      await this.clickByTestId(this.decryptMainPrivateKeyButtonSelector);
    });
  }

  async fillInDecryptPassword(password) {
    await allure.step('Fill in Decrypt Password', async () => {
      await this.fillByTestId(this.decryptPasswordInputSelector, password);
    });
  }

  async clickOnDecryptButton() {
    await allure.step('Click on Decrypt Button', async () => {
      await this.clickByTestId(this.decryptPasswordButtonSelector);
    });
  }

  async getPrivateKeyText() {
    return allure.step('Get Private Key Text', async () => {
      return await this.getTextByTestId(this.decryptedPrivateKeySelector);
    });
  }

  async clickOnDeleteButtonAtIndex(index) {
    await allure.step('Click on Delete Button at Index', async () => {
      await this.clickByTestId(this.deleteKeyButtonPrefix + index);
    });
  }

  async clickOnDeleteKeyPairButton() {
    await allure.step('Click on Delete Key Pair Button', async () => {
      await this.clickByTestId(this.deleteKeyPairButton);
    });
  }

  async fillInCurrentPassword(password) {
    await allure.step('Fill in Current Password', async () => {
      await this.fillByTestId(this.currentPasswordInputSelector, password);
    });
  }

  async fillInNewPassword(password) {
    await allure.step('Fill in New Password', async () => {
      await this.fillByTestId(this.newPasswordInputSelector, password);
    });
  }

  async clickOnChangePasswordButton() {
    await allure.step('Click on Change Password Button', async () => {
      await this.clickByTestId(this.changePasswordButtonSelector);
    });
  }

  async clickOnConfirmChangePassword() {
    await allure.step('Click on Confirm Change Password', async () => {
      await this.clickByTestId(this.confirmChangePasswordButtonSelector);
    });
  }

  async clickOnCloseButton() {
    await allure.step('Click on Close Button', async () => {
      await this.waitForElementToBeVisible(this.closeButtonSelector, 15000);
      await this.clickByTestId(this.closeButtonSelector);
    });
  }
}

module.exports = SettingsPage;
