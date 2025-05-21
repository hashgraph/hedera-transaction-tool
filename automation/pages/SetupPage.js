import { createTestUsersBatch } from '../utils/databaseUtil';
import path from "path";

const BasePage = require('./BasePage');
const RegistrationPage = require('./RegistrationPage');
const dotenv = require('dotenv');

// Load base .env file
dotenv.config({ path: path.join(__dirname, './.env') });

class Org {
  constructor(nickname, url, username, password, mnemonic, isLocal) {
    this.nickname = nickname;
    this.url = url;
    this.username = username;
    this.password = password;
    this.mnemonic = mnemonic;
    this.isLocal = isLocal;
  }
}

function toCamelCase(snakeCase) {
  return snakeCase.toLowerCase().replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
}

const orgs = Object.entries(process.env).reduce((acc, [key, value]) => {
  if (key.startsWith('ORG_')) {
    const parts = key.split('_');
    const orgNumber = parts[1];
    const orgKey = toCamelCase(parts.slice(2).join('_'));

    if (!acc[orgNumber]) {
      acc[orgNumber] = new Org();
    }

    acc[orgNumber][orgKey] = value;
  }
  return acc;
}, {});

class SetupPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.users = []; // List to store user credentials
    this.registrationPage = new RegistrationPage(window);
  }

  /* Selectors */

  // Buttons
  addNewOrganizationButtonSelector = 'button-add-new-organization';
  continueEncryptPasswordButtonSelector = 'button-continue-encrypt-password';
  addOrganizationButtonInModalSelector = 'button-add-organization-in-modal';
  signInOrganizationButtonSelector = 'button-sign-in-organization-user';
  keychainLoginButtonSelector = 'button-keychain-login';
  loginButtonSelector = 'button-login';

  // Inputs
  organizationNicknameInputSelector = 'input-organization-nickname';
  serverUrlInputSelector = 'input-server-url';
  encryptPasswordInputSelector = 'input-encrypt-password';
  emailForOrganizationInputSelector = 'input-login-email-for-organization';
  passwordForOrganizationInputSelector = 'input-login-password-for-organization';
  emailInputSelector = 'input-email';
  passwordInputSelector = 'input-password';
  confirmPasswordInputSelector = 'input-confirm-password';

  async createLocalDatabase() {
    for (const org of Object.values(orgs)) {
      if (org.isLocal) {
        await this.createUser(org.username, org.password);
      }
    }
  }

  async register() {
    if (process.env.USE_KEYCHAIN) {
      await this.useKeychainLogin();
    } else {
      await this.useCredentialsLogin(process.env.USERNAME, process.env.PASSWORD);
    }
  }

  async useKeychainLogin() {
    await this.click(this.keychainLoginButtonSelector);
  }

  async useCredentialsLogin(username, password) {
    await this.fill(this.emailInputSelector, username);
    await this.fill(this.passwordInputSelector, password);
    await this.fill(this.confirmPasswordInputSelector, password);
    await this.click(this.loginButtonSelector);
  }

  async fillInMnemonic() {
    const mnemonicCsv = process.env.MNEMONIC;
    const mnemonicWords = mnemonicCsv.split(',');

    for (let i = 1; i <= 24; i++) {
      const word = mnemonicWords[i-1];
      if (word) {
        // I think it is 1 based because th AppRecoveryPhraseWord is 1 based.
        // Not sure, probably should have been 0 based
        // and let the AppRecoveryPhraseWord handle the difference.
        const selector = this.registrationPage.getRecoveryWordSelector(i);
        await this.fill(selector, word);
      }
    }
    await this.registrationPage.clickOnNextImportButton();
  }

  async finishRegistration(){
    await this.registrationPage.waitForElementToDisappear(
      this.registrationPage.toastMessageSelector,
    );
    await this.registrationPage.clickOnFinalNextButtonWithRetry();
  }

  async clickOnAddNewOrganizationButton() {
    await this.click(this.addNewOrganizationButtonSelector);
  }

  async fillOrganizationDetailsAndContinue(organizationNickname, serverUrl) {
    await this.fill(this.organizationNicknameInputSelector, organizationNickname);
    await this.fill(this.serverUrlInputSelector, serverUrl);
    await this.click(this.addOrganizationButtonInModalSelector);
  }

  async isEncryptPasswordInputVisible() {
    return await this.isElementVisible(this.encryptPasswordInputSelector);
  }

  async fillOrganizationEncryptionPasswordAndContinue(password) {
    await this.fill(this.encryptPasswordInputSelector, password);
    await this.click(this.continueEncryptPasswordButtonSelector);
  }

  async signInOrganization(email, password, encryptionPassword) {
    await this.fill(this.emailForOrganizationInputSelector, email);
    await this.fill(this.passwordForOrganizationInputSelector, password);
    await this.click(this.signInOrganizationButtonSelector);
    if (await this.isEncryptPasswordInputVisible()) {
      await this.fillOrganizationEncryptionPasswordAndContinue(encryptionPassword);
    }
  }

  async setupOrganizations() {
    for (const org of Object.values(orgs)) {
      await this.clickOnAddNewOrganizationButton();
      await this.fillOrganizationDetailsAndContinue(org.nickname, org.url);
      await this.signInOrganization(org.username, org.password, process.env.PASSWORD);
      await this.fillInMnemonic(org.mnemonic.split(','));
      await this.finishRegistration();
    }
  }

  async createUser(email, password) {
    const usersData = [];

    usersData.push({email, password});

    // Pass the batch of user data to the database utility function
    await createTestUsersBatch(usersData);
  }
}

module.exports = SetupPage;
