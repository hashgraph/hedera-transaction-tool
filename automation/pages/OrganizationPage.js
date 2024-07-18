import { queryDatabase, queryPostgresDatabase, createTestUser } from '../utils/databaseUtil';
import { generateMnemonic } from '../utils/keyUtil';
const BasePage = require('./BasePage');
const RegistrationPage = require('./RegistrationPage');
const SettingsPage = require('./SettingsPage');
const {
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
} = require('../utils/util');

class OrganizationPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.users = []; // List to store user credentials
    this.organizationRecoveryWords = [];
    this.badOrganizationList = [];
    this.registrationPage = new RegistrationPage(window);
    this.settingsPage = new SettingsPage(window);
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
  deleteOrganizationButtonSelector = 'button-delete-connection';
  dropdownSelectModeSelector = 'dropdown-select-mode';
  editNicknameOrganizationButtonSelector = 'button-edit-nickname';
  closeErrorModalButtonSelector = 'button-close-modal';
  logoutButtonSelector = 'button-logout';
  contactListButton = 'button-contact-list';
  deleteNextButtonSelector = 'button-delete-next';

  // Inputs
  organizationNicknameInputSelector = 'input-organization-nickname';
  serverUrlInputSelector = 'input-server-url';
  encryptPasswordInputSelector = 'input-encrypt-password';
  emailForOrganizationInputSelector = 'input-login-email-for-organization';
  passwordForOrganizationInputSelector = 'input-login-password-for-organization';
  editOrganizationNicknameInputSelector = 'input-edit-nickname';

  // Texts
  organizationErrorMessageSelector = 'p-organization-error-message';
  organizationNicknameTextSelector = 'span-organization-nickname';

  // Others
  modeSelectionIndexSelector = 'dropdown-item-';
  firstMissingKeyIndexSelector = 'cell-index-missing-0';

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
    if (await this.isEncryptPasswordInputVisible()) {
      await this.fillOrganizationEncryptionPasswordAndContinue(encryptionPassword);
    }
  }

  async isEncryptPasswordInputVisible() {
    return await this.isElementVisible(this.encryptPasswordInputSelector);
  }

  async fillInLoginDetailsAndClickSignIn(email, password) {
    await this.fillByTestId(this.emailForOrganizationInputSelector, email);
    await this.fillByTestId(this.passwordForOrganizationInputSelector, password);
    await this.clickByTestId(this.signInOrganizationButtonSelector);
  }

  async setupOrganization() {
    const organizationNickname = 'Test Organization';
    const serverUrl = process.env.ORGANIZATION_URL;
    await this.clickOnAddNewOrganizationButton();
    await this.fillOrganizationDetailsAndContinue(organizationNickname, serverUrl);
  }

  async setupWrongOrganization() {
    const organizationNickname = 'Bad Organization';
    const serverUrl = process.env.ORGANIZATION_URL + Math.floor(Math.random() * 10);
    await this.clickOnAddNewOrganizationButton();
    await this.fillOrganizationDetailsAndContinue(organizationNickname, serverUrl);
    this.badOrganizationList.push(organizationNickname);
  }

  /**
   * Method to create users for the organization
   *
   * @param {number} numUsers - The number of users to create
   */

  async createUsers(numUsers = 1) {
    for (let i = 0; i < numUsers; i++) {
      const email = generateRandomEmail();
      const password = generateRandomPassword();

      // Create test user in PostgreSQL database
      await createTestUser(email, password);

      // Store user credentials in the list
      this.users.push({ email, password });
    }
  }

  /**
   * Method to set up users for the organization
   *
   * @param {Object} window - The window object
   * @param {string} encryptionPassword - The encryption password
   */
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

      await this.waitForElementToBeVisible(this.registrationPage.createNewTabSelector);
      await this.registrationPage.clickOnCreateNewTab();
      await this.registrationPage.clickOnUnderstandCheckbox();
      await this.registrationPage.clickOnGenerateButton();

      await this.captureRecoveryPhraseWords();
      await this.registrationPage.clickOnUnderstandCheckbox();
      await this.registrationPage.clickOnVerifyButton();

      await this.fillAllMissingRecoveryPhraseWords();
      await this.registrationPage.clickOnNextButton();

      await this.registrationPage.waitForElementToDisappear(
        this.registrationPage.toastMessageSelector,
      );
      await this.registrationPage.clickOnFinalNextButtonWithRetry();

      await setupEnvironmentForTransactions(window, encryptionPassword, privateKey);
      await this.clickByTestId(this.logoutButtonSelector);
      await this.waitForElementToBeVisible(this.emailForOrganizationInputSelector);
    }
  }

  async recoverAccount() {
    await this.fillAllMissingRecoveryPhraseWords();
    await this.registrationPage.clickOnNextImportButton();

    await this.registrationPage.waitForElementToDisappear(
      this.registrationPage.toastMessageSelector,
    );

    if (await this.isDeleteNextButtonVisible()) {
      await this.clickOnDeleteNextButton();
    }
    await this.registrationPage.clickOnFinalNextButtonWithRetry();
  }

  async recoverPrivateKey(window, encryptionPassword) {
    // for the purposes of settings tests we are recovering User#1 which has PRIVATE_KEY_2 in the database
    await setupEnvironmentForTransactions(window, encryptionPassword, process.env.PRIVATE_KEY_2);
  }

  getUser(index) {
    if (index < 0 || index >= this.users.length) {
      throw new Error('Invalid user index');
    }
    return this.users[index];
  }

  changeUserPassword(email, newPassword) {
    const user = this.users.find(user => user.email === email);
    if (!user) {
      throw new Error(`User with email ${email} is not defined`);
    }

    console.log(`Changing password for user: ${email}`);
    user.password = newPassword;
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

  async getOrganizationErrorMessage() {
    return await this.getTextByTestId(this.organizationErrorMessageSelector);
  }

  async clickOnCloseErrorModalButton() {
    await this.clickByTestId(this.closeErrorModalButtonSelector);
  }

  async clickOnDeleteSecondOrganization() {
    await this.clickByTestIdWithIndex(this.deleteOrganizationButtonSelector, 1);
  }

  async clickOnDeleteFirstOrganization() {
    await this.clickByTestIdWithIndex(this.deleteOrganizationButtonSelector, 0);
  }

  async ensureBadOrganizationExists() {
    if (this.badOrganizationList.length === 0) {
      await this.settingsPage.clickOnSettingsButton();
      await this.settingsPage.clickOnOrganisationsTab();
      await this.setupWrongOrganization();
      await this.clickOnCloseErrorModalButton();
    }
  }

  async clickOnSelectModeDropdown() {
    await this.clickByTestId(this.dropdownSelectModeSelector);
  }

  async selectModeByIndex(index) {
    await this.clickByTestId(this.modeSelectionIndexSelector + index);
  }

  async selectPersonalMode() {
    await this.clickOnSelectModeDropdown();
    await this.selectModeByIndex(0);
  }

  async selectOrganizationMode() {
    await this.clickOnSelectModeDropdown();
    await this.selectModeByIndex(1);
  }

  async logoutFromOrganization() {
    const { delay } = await import('../utils/util.js');
    await this.selectOrganizationMode();
    await delay(500);
    await this.clickByTestId(this.logoutButtonSelector);
  }

  async verifyOrganizationExists(nickname) {
    const query = `
      SELECT COUNT(*) AS count
      FROM main.Organization
      WHERE nickname = ?`;

    try {
      const row = await queryDatabase(query, [nickname]);
      return row ? row.count > 0 : false;
    } catch (error) {
      console.error('Error verifying organization:', error);
      return false;
    }
  }

  // Method to capture all the recovery phrase words and their indexes
  async captureRecoveryPhraseWords() {
    this.organizationRecoveryWords = {};
    for (let i = 1; i <= 24; i++) {
      const selector = this.registrationPage.getRecoveryWordSelector(i);
      const wordElement = await this.window.getByTestId(selector);
      this.organizationRecoveryWords[i] = await wordElement.inputValue();
    }
  }

  // Method to fill a missing recovery phrase word by index
  async fillRecoveryPhraseWord(index, word) {
    const selector = this.registrationPage.getRecoveryWordSelector(index);
    await this.fillByTestId(selector, word);
  }

  // Method to fill in all missing recovery phrase words based on the saved recoveryPhraseWords
  async fillAllMissingRecoveryPhraseWords() {
    for (let i = 1; i <= 24; i++) {
      const selector = this.registrationPage.getRecoveryWordSelector(i);
      const wordElement = await this.window.getByTestId(selector);
      const value = await wordElement.inputValue();
      if (!value) {
        const word = this.organizationRecoveryWords[i];
        if (word) {
          await this.fillRecoveryPhraseWord(i, word);
        }
      }
    }
  }

  generateAndSetRecoveryWords() {
    const mnemonic = generateMnemonic();
    const words = mnemonic.split(' ');

    // Ensure we have exactly 24 words
    if (words.length !== 24) {
      throw new Error('Generated mnemonic does not have exactly 24 words');
    }

    // Update organizationRecoveryWords
    this.organizationRecoveryWords = {};
    words.forEach((word, index) => {
      this.organizationRecoveryWords[index + 1] = word; // Using 1-based index for recovery words
    });
  }

  async clickOnContactListButton() {
    await this.clickByTestId(this.contactListButton);
  }

  async isContactListButtonVisible() {
    return await this.isElementVisible(this.contactListButton);
  }

  async clickOnEditNicknameOrganizationButton() {
    await this.clickByTestId(this.editNicknameOrganizationButtonSelector);
  }

  async fillInNewOrganizationNickname(nickname) {
    await this.fillByTestId(this.editOrganizationNicknameInputSelector, nickname);
  }

  async getOrganizationNicknameText() {
    return await this.getTextByTestId(this.organizationNicknameTextSelector);
  }

  async editOrganizationNickname(newNickname) {
    const { delay } = await import('../utils/util.js');
    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
      const currentNickname = await this.getOrganizationNicknameText();
      if (currentNickname !== newNickname) {
        await this.clickOnEditNicknameOrganizationButton();
        await delay(500);
        await this.fillInNewOrganizationNickname(newNickname);
        await this.settingsPage.clickOnOrganisationsTab();
        retries++;
      } else {
        break;
      }
    }
  }

  async isFirstMissingKeyVisible() {
    return await this.isElementVisible(this.firstMissingKeyIndexSelector);
  }

  async clickOnDeleteNextButton() {
    await this.clickByTestId(this.deleteNextButtonSelector);
  }

  async isDeleteNextButtonVisible() {
    return await this.isElementVisible(this.deleteNextButtonSelector);
  }

  async getPublicKeyByEmail(email) {
    const query = `
      SELECT uk."publicKey"
      FROM public."user" u
      JOIN public.user_key uk ON u.id = uk."userId"
      WHERE u.email = $1 AND uk.index = 0;
    `;

    try {
      const result = await queryPostgresDatabase(query, [email]);
      return result[0]?.publicKey || null;
    } catch (error) {
      console.error('Error fetching public key by email:', error);
      return null;
    }
  }

  async getUserIdByEmail(email) {
    const query = `
      SELECT id
      FROM public."user"
      WHERE email = $1;
    `;

    try {
      const result = await queryPostgresDatabase(query, [email]);
      return result[0]?.id || null;
    } catch (error) {
      console.error('Error fetching user ID by email:', error);
      return null;
    }
  }

  async isKeyDeleted(publicKey) {
    const checkDeletionQuery = `
    SELECT "deletedAt"
    FROM public.user_key
    WHERE "publicKey" = $1;
  `;

    try {
      const deletionResult = await queryPostgresDatabase(checkDeletionQuery, [publicKey]);
      const isDeleted = deletionResult[0]?.deletedAt !== null;

      if (isDeleted) {
        console.log('The key is marked as deleted.');
        return true;
      } else {
        console.log('The key is not deleted.');
        return false;
      }
    } catch (error) {
      console.error('Error checking if key is deleted:', error);
      return false;
    }
  }

  async findNewKey(userId) {
    const findNewKeyQuery = `
    SELECT "publicKey"
    FROM public.user_key
    WHERE "userId" = $1 AND index = 0 AND "deletedAt" IS NULL;
  `;

    try {
      const newKeyResult = await queryPostgresDatabase(findNewKeyQuery, [userId]);
      if (newKeyResult.length > 0) {
        console.log('A new key has been found for the user:', newKeyResult[0].publicKey);
        return true;
      } else {
        console.log('No new key found for the user.');
        return false;
      }
    } catch (error) {
      console.error('Error finding new key for user:', error);
      return false;
    }
  }
}

module.exports = OrganizationPage;
