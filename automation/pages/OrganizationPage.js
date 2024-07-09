const BasePage = require('./BasePage');
const RegistrationPage = require('./RegistrationPage');
const { createTestUser } = require('../utils/databaseUtil');
const {
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
} = require('../utils/util');
const { expect } = require('playwright/test');

class OrganizationPage extends BasePage {
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
  readyForReviewTabSelector = 'tab-0';
  readyToSignTabSelector = 'tab-1';
  inProgressTabSelector = 'tab-2';
  readyForExecutionTabSelector = 'tab-3';
  draftsTabSelector = 'tab-4';
  historyTabSelector = 'tab-5';

  // Inputs
  organizationNicknameInputSelector = 'input-organization-nickname';
  serverUrlInputSelector = 'input-server-url';
  encryptPasswordInputSelector = 'input-encrypt-password';
  emailForOrganizationInputSelector = 'input-login-email-for-organization';
  passwordForOrganizationInputSelector = 'input-login-password-for-organization';

  async clickOnAddNewOrganizationButton() {
    await this.clickByTestId(this.addNewOrganizationButtonSelector);
  }

  async fillOrganizationDetailsAndContinue(organizationNickname, serverUrl) {
    await this.fillByTestId(this.organizationNicknameInputSelector, organizationNickname);
    await this.fillByTestId(this.serverUrlInputSelector, serverUrl);
    await this.clickByTestId(this.addOrganizationButtonInModalSelector);
  }

  async fillOrganizationEncryptionPasswordAndContinue(password) {
    await this.fillByTestId(this.encryptPasswordInputSelector, password);
    await this.clickByTestId(this.continueEncryptPasswordButtonSelector);
  }

  async signInOrganization(email, password, encryptionPassword) {
    await this.fillByTestId(this.emailForOrganizationInputSelector, email);
    await this.fillByTestId(this.passwordForOrganizationInputSelector, password);
    await this.clickByTestId(this.signInOrganizationButtonSelector);
    const isAppPasswordRequired = await this.isElementVisible(this.encryptPasswordInputSelector);
    if (isAppPasswordRequired) {
      await this.fillOrganizationEncryptionPasswordAndContinue(encryptionPassword);
    }
  }

  async setupOrganization() {
    const organizationNickname = 'Test Organization';
    const serverUrl = process.env.ORGANIZATION_URL;
    await this.clickOnAddNewOrganizationButton();
    await this.fillOrganizationDetailsAndContinue(organizationNickname, serverUrl);
  }

  async createUsers(numUsers = 3) {
    for (let i = 0; i < numUsers; i++) {
      const email = generateRandomEmail();
      const password = generateRandomPassword();

      // Create test user in PostgreSQL database
      await createTestUser(email, password);

      // Store user credentials in the list
      this.users.push({ email, password });
    }
  }

  async setUpUsers(window, encryptionPassword) {
    const privateKeys = [
      process.env.PRIVATE_KEY_2,
      process.env.PRIVATE_KEY_3,
      process.env.PRIVATE_KEY_4,
    ];

    for (let i = 0; i < this.users.length; i++) {
      const user = this.users[i];
      const privateKey = privateKeys[i % privateKeys.length];

      await this.signInOrganization(user.email, user.password, encryptionPassword);
      //await this.fillOrganizationEncryptionPasswordAndContinue(encryptionPassword);

      await this.waitForElementToBeVisible(this.registrationPage.createNewTabSelector);
      await this.registrationPage.clickOnCreateNewTab();
      await this.registrationPage.clickOnUnderstandCheckbox();
      await this.registrationPage.clickOnGenerateButton();

      await this.registrationPage.captureRecoveryPhraseWords();
      await this.registrationPage.clickOnUnderstandCheckbox();
      await this.registrationPage.clickOnVerifyButton();

      await this.registrationPage.fillAllMissingRecoveryPhraseWords();
      await this.registrationPage.clickOnNextButton();

      await this.registrationPage.waitForElementToDisappear(this.toastMessageSelector);
      await this.registrationPage.clickOnFinalNextButtonWithRetry();

      await setupEnvironmentForTransactions(window, encryptionPassword, privateKey);
      await this.clickByTestId(this.registrationPage.logoutButtonSelector);
      await this.waitForElementToBeVisible(this.emailForOrganizationInputSelector);
    }
  }

  getUser(index) {
    if (index < 0 || index >= this.users.length) {
      throw new Error('Invalid user index');
    }
    return this.users[index];
  }

  async returnAllTabsVisible() {
    const checks = await Promise.all([
      this.isElementVisible(this.readyForReviewTabSelector),
      this.isElementVisible(this.readyToSignTabSelector),
      this.isElementVisible(this.inProgressTabSelector),
      this.isElementVisible(this.readyForExecutionTabSelector),
      this.isElementVisible(this.draftsTabSelector),
      this.isElementVisible(this.historyTabSelector),
    ]);
    return checks.every(isTrue => isTrue);
  }
}

module.exports = OrganizationPage;
