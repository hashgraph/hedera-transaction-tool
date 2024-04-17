const BasePage = require('./BasePage');
const { queryDatabase } = require('../utils/databaseUtil');

class SettingsPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.currentIndex = '1';
  }

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
  consensusNodeEndpointInputSelector = 'input-consensus-endpoint';
  mirrorNodeGrpcEndpointSelector = 'input-mirror-grpc-endpoint';
  mirrorNodeRestEndpointSelector = 'input-mirror-rest-endpoint';
  nodeAccountidInputSelector = 'input-node-accountid';
  setButtonSelector = 'button-set';
  restoreButtonSelector = 'button-restore';
  continueButtonSelector = 'button-continue';
  cancelButtonSelector = 'button-cancel';
  passwordInputSelector = 'input-password';
  continuePasswordButtonSelector = 'button-continue-password';
  indexInputSelector = 'input-index';
  continueIndexButtonSelector = 'button-continue-index';
  nicknameInputSelector = 'input-nickname';
  continueNicknameButtonSelector = 'button-continue-nickname';
  continuePhraseButtonSelector = 'button-continue-phrase';
  importButtonSelector = 'button-restore-dropdown'

  async verifySettingsElements() {
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
  }

  async incrementIndex() {
    let numericValue = parseInt(this.currentIndex);
    numericValue++;
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
      // Check if the row is not empty and both public_key and private_key are not null
      return (row !== undefined) && (row.public_key!==undefined) && (row.private_key!==undefined);
    } catch (error) {
      console.error('Error verifying keys for index:', error);
      return false;
    }
  }

  async clickOnSettingsButton() {
    await this.clickByTestId(this.settingsButtonSelector);
  }

  async clickOnKeysTab() {
    await this.clickByTestId(this.keysTabButtonSelector);
  }

  async clickOnRestoreButton() {
    await this.clickByTestId(this.restoreButtonSelector);
  }

  async clickOnContinueButton() {
    await this.clickByTestId(this.continueButtonSelector);
  }

  async fillInPassword(password) {
    await this.fillByTestId(this.passwordInputSelector, password);
  }

  async clickOnPasswordContinueButton() {
    await this.clickByTestId(this.continuePasswordButtonSelector);
  }

  async fillInIndex(index = 1) {
    await this.fillByTestId(this.indexInputSelector, index);
  }

  async clickOnIndexContinueButton() {
    await this.clickByTestId(this.continueIndexButtonSelector);
  }

  async fillInNickname(nickname) {
    await this.fillByTestId(this.nicknameInputSelector, nickname);
  }

  async clickOnNicknameContinueButton() {
    await this.clickByTestId(this.continueNicknameButtonSelector);
    await this.incrementIndex();
  }

  async clickOnContinuePhraseButton() {
    await this.clickByTestId(this.continuePhraseButtonSelector);
  }

  async clickOnCustomTab() {
    await this.clickByTestId(this.customTabButtonSelector);
  }

  async getConsensusNodeEndpointText() {
    return await this.getTextFromInputFieldByTestId(this.consensusNodeEndpointInputSelector);
  }

  async getMirrorNodeGrpcEndpointText() {
    return await this.getTextFromInputFieldByTestId(this.mirrorNodeGrpcEndpointSelector);
  }

  async getMirrorNodeRestEndpointText() {
    return await this.getTextFromInputFieldByTestId(this.mirrorNodeRestEndpointSelector);
  }

  async getNodeAccountIdInputText() {
    return await this.getTextFromInputFieldByTestId(this.nodeAccountidInputSelector);
  }

  async isSetButtonVisible() {
    return await this.isElementVisible(this.setButtonSelector);
  }
}
module.exports = SettingsPage;
