import { createTestUsersBatch } from '../utils/databaseUtil';
import { generateMnemonic } from '../utils/keyUtil';
const bcrypt = require('bcryptjs');
const { Mnemonic } = require('@hashgraph/sdk');
const { encrypt } = require('../utils/crypto');
const {
  encodeExchangeRates,
  encodeFeeSchedule,
  encodeNodeAddressBook,
  encodeServicesConfigurationList,
  encodeThrottleDefinitions,
} = require('../utils/encodeSystemFiles');

const BasePage = require('./BasePage');
const RegistrationPage = require('./RegistrationPage');
const SettingsPage = require('./SettingsPage');
const TransactionPage = require('./TransactionPage');
const {
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
  waitForValidStart,
  compareJsonFiles,
  parsePropertiesContent,
} = require('../utils/util');
const { normalizeExchangeRateData, normalizeThrottleData } = require('../utils/dataNormalizer');
const {
  getFirstPublicKeyByEmail,
  getUserIdByEmail,
  isKeyDeleted,
  findNewKey,
  getAllTransactionIdsForUserObserver,
  verifyOrganizationExists,
  insertUserKey,
  insertKeyPair,
  getLatestNotificationStatusByEmail,
} = require('../utils/databaseQueries');
const fs = require('fs');

class OrganizationPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.users = []; // List to store user credentials
    this.transactions = []; // List to store transactions
    this.organizationRecoveryWords = []; // List to store recovery phrase words for organization
    this.badOrganizationList = []; // List to store bad organizations
    this.complexAccountId = []; // List to store complex account ids
    this.registrationPage = new RegistrationPage(window);
    this.settingsPage = new SettingsPage(window);
    this.transactionPage = new TransactionPage(window);
  }

  /* Selectors */

  // Buttons
  addNewOrganizationButtonSelector = 'button-add-new-organization';
  continueEncryptPasswordButtonSelector = 'button-continue-encrypt-password';
  addOrganizationButtonInModalSelector = 'button-add-organization-in-modal';
  signInOrganizationButtonSelector = 'button-sign-in-organization-user';
  draftsTabSelector = 'tab-0';
  readyForReviewTabSelector = 'tab-1';
  readyToSignTabSelector = 'tab-2';
  inProgressTabSelector = 'tab-3';
  readyForExecutionTabSelector = 'tab-4';
  historyTabSelector = 'tab-5';
  deleteOrganizationButtonSelector = 'button-delete-connection';
  dropdownSelectModeSelector = 'dropdown-select-mode';
  dropdownSelectedModeSelector = 'dropdown-selected-mode';
  editNicknameOrganizationButtonSelector = 'button-edit-nickname';
  closeErrorModalButtonSelector = 'button-close-modal';
  logoutButtonSelector = 'button-logout';
  contactListButton = 'button-contact-list';
  deleteNextButtonSelector = 'button-delete-next';
  addObserverButtonSelector = 'button-add-observer';
  addUserButtonSelector = 'button-add-user';
  timePickerIconSelector = '.dp--tp-wrap button[aria-label="Open time picker"]';
  incrementSecondsButtonSelector = 'button[aria-label="Increment seconds"]';
  incrementMinutesButtonSelector = 'button[aria-label="Increment minutes"]';
  incrementHourButtonSelector = 'button[aria-label="Increment hours"]';
  secondsOverlayButtonSelector = 'button[data-test="seconds-toggle-overlay-btn-0"]';
  minutesOverlayButtonSelector = 'button[data-test="minutes-toggle-overlay-btn-0"]';
  hoursOverlayButtonSelector = 'button[data-test="hours-toggle-overlay-btn-0"]';
  signTransactionButtonSelector = 'button-sign-org-transaction';
  nextTransactionButtonSelector = 'button-next-org-transaction';
  signAllTransactionsButtonSelector = 'button-sign-all-tx';

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
  transactionDetailsIdSelector = 'p-transaction-details-id';
  transactionValidStartSelector = 'p-transaction-details-valid-start';
  secondSignerCheckmarkSelector = 'span-checkmark-public-key-1-0';
  spanNotificationNumberSelector = 'span-notification-number';
  transactionIdInGroupSelector = 'td-group-transaction-id';
  validStartTimeInGroupSelector = 'td-group-valid-start-time';

  // Indexes
  modeSelectionIndexSelector = 'dropdown-item-';
  firstMissingKeyIndexSelector = 'cell-index-missing-0';
  readyForSignTransactionIdIndexSelector = 'td-transaction-id-for-sign-';
  readyForSignTransactionTypeIndexSelector = 'td-transaction-type-for-sign-';
  readyForSignValidStartIndexSelector = 'td-transaction-valid-start-for-sign-';
  readyForSignSubmitSignButtonIndexSelector = 'button-transaction-sign-';
  inProgressTransactionIdIndexSelector = 'td-transaction-id-in-progress-';
  inProgressTransactionTypeIndexSelector = 'td-transaction-type-in-progress-';
  inProgressValidStartIndexSelector = 'td-transaction-valid-start-in-progress-';
  inProgressDetailsButtonIndexSelector = 'button-transaction-in-progress-details-';
  readyForExecutionTransactionIdIndexSelector = 'td-transaction-id-ready-execution-';
  readyForExecutionTransactionTypeIndexSelector = 'td-transaction-type-ready-execution-';
  readyForExecutionValidStartIndexSelector = 'td-transaction-valid-start-ready-execution-';
  readyForExecutionDetailsButtonIndexSelector = 'button-transaction-ready-execution-details-';
  historyTransactionIdIndexSelector = 'td-transaction-id-';
  historyTransactionTypeIndexSelector = 'td-transaction-type-';
  historyTransactionStatusIndexSelector = 'td-transaction-status-';
  historyCreatedAtIndexSelector = 'td-transaction-createdAt-';
  historyDetailsButtonIndexSelector = 'button-transaction-details-';
  stageBubbleIndexSelector = 'div-stepper-nav-item-bubble-';
  observerIndexSelector = 'span-group-email-';
  userListIndexSelector = 'span-email-';
  contactListPublicKeyTypeIndexSelector = 'p-contact-public-type-key-';

  async clickOnAddNewOrganizationButton() {
    await this.click(this.addNewOrganizationButtonSelector);
  }

  async fillOrganizationDetailsAndContinue(organizationNickname, serverUrl) {
    await this.fill(this.organizationNicknameInputSelector, organizationNickname);
    await this.fill(this.serverUrlInputSelector, serverUrl);
    await this.click(this.addOrganizationButtonInModalSelector);
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

  async isEncryptPasswordInputVisible() {
    return await this.isElementVisible(this.encryptPasswordInputSelector);
  }

  async fillInLoginDetailsAndClickSignIn(email, password) {
    await this.fill(this.emailForOrganizationInputSelector, email);
    await this.fill(this.passwordForOrganizationInputSelector, password);
    await this.click(this.signInOrganizationButtonSelector);
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
    const usersData = [];

    for (let i = 0; i < numUsers; i++) {
      const email = generateRandomEmail();
      const password = generateRandomPassword();
      usersData.push({ email, password });
      this.users.push({ email, password });
    }

    // Pass the batch of user data to the database utility function
    await createTestUsersBatch(usersData);
  }

  async setUpUsers(window, encryptionPassword, setPrivateKey = true) {
    for (let i = 0; i < this.users.length; i++) {
      const user = this.users[i];
      const privateKey = process.env.PRIVATE_KEY;

      if (i === 0) {
        // Full setup for the first user (index 0) who is payer
        await this.signInOrganization(user.email, user.password, encryptionPassword);

        await this.waitForElementToBeVisible(this.registrationPage.createNewTabSelector);
        await this.registrationPage.clickOnCreateNewTab();
        await this.registrationPage.clickOnUnderstandCheckbox();
        await this.registrationPage.clickOnGenerateButton();

        await this.captureRecoveryPhraseWordsForUser(i);
        await this.registrationPage.clickOnUnderstandCheckbox();
        await this.registrationPage.clickOnVerifyButton();

        await this.fillAllMissingRecoveryPhraseWordsForUser(i);
        await this.registrationPage.clickOnNextButton();

        await this.registrationPage.waitForElementToDisappear(
          this.registrationPage.toastMessageSelector,
        );
        await this.registrationPage.clickOnFinalNextButtonWithRetry();

        if (setPrivateKey) {
          await setupEnvironmentForTransactions(window, privateKey);
        }

        await this.click(this.logoutButtonSelector);
        await this.waitForElementToBeVisible(this.emailForOrganizationInputSelector);
      } else {
        await this.generateAndStoreUserKey(user.email, encryptionPassword);
      }
    }
  }

  async generateAndStoreUserKey(email, password) {
    // Generate a 24-word mnemonic phrase
    const mnemonic = await Mnemonic.generate();

    // Hash the mnemonic phrase
    const mnemonicHash = bcrypt.hashSync(mnemonic._mnemonic.words.toString(), 10);

    const privateKey = await mnemonic.toStandardEd25519PrivateKey('', 0);

    const privateKeyString = privateKey.toStringRaw();
    const publicKeyString = privateKey.publicKey.toStringRaw();

    // Encrypt the private key
    const encryptedPrivateKey = encrypt(privateKeyString, password);

    // Get the user ID by email
    const userId = await getUserIdByEmail(email);

    // Insert the mnemonic hash and public key into the user_key table
    await insertUserKey(userId, mnemonicHash, 0, publicKeyString);

    // Insert the public key and encrypted private key into the key_pair table
    await insertKeyPair(publicKeyString, encryptedPrivateKey, mnemonicHash, userId);
  }

  async recoverAccount(userIndex) {
    await this.fillAllMissingRecoveryPhraseWordsForUser(userIndex);
    await this.registrationPage.clickOnNextImportButton();

    await this.registrationPage.waitForElementToDisappear(
      this.registrationPage.toastMessageSelector,
    );

    if (await this.isDeleteNextButtonVisible()) {
      await this.clickOnDeleteNextButton();
    }
    await this.registrationPage.clickOnFinalNextButtonWithRetry();
  }

  async recoverPrivateKey(window) {
    // for the purposes of settings tests we are recovering User#1 which has PRIVATE_KEY_2 in the database
    await setupEnvironmentForTransactions(window, process.env.PRIVATE_KEY);
  }

  getUser(index) {
    if (index < 0 || index >= this.users.length) {
      throw new Error('Invalid user index');
    }
    return this.users[index];
  }

  getUserPasswordByEmail(email) {
    const user = this.users.find(user => user.email === email);
    if (!user) {
      throw new Error(`User with email ${email} is not defined`);
    }
    return user.password;
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
    return await this.getText(this.organizationErrorMessageSelector);
  }

  async clickOnCloseErrorModalButton() {
    await this.click(this.closeErrorModalButtonSelector);
  }

  async clickOnDeleteSecondOrganization() {
    await this.click(this.deleteOrganizationButtonSelector, 1);
  }

  async clickOnDeleteFirstOrganization() {
    await this.click(this.deleteOrganizationButtonSelector, 0);
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
    await this.click(this.dropdownSelectModeSelector);
  }

  async getNotificationElementFromDropdown() {
    return await this.hasBeforePseudoElement(this.dropdownSelectedModeSelector);
  }

  async getNotificationElementFromFirstTransaction() {
    return await this.hasBeforePseudoElement(this.readyForSignTransactionIdIndexSelector + '0');
  }

  async selectModeByIndex(index) {
    await this.click(this.modeSelectionIndexSelector + index);
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
    await this.selectOrganizationMode();
    await new Promise(resolve => setTimeout(resolve, 500));
    await this.click(this.logoutButtonSelector);
  }

  async verifyOrganizationExists(nickname) {
    return await verifyOrganizationExists(nickname);
  }

  // Method to capture all the recovery phrase words and their indexes
  async captureRecoveryPhraseWordsForUser(userIndex) {
    this.organizationRecoveryWords[userIndex] = {};
    for (let i = 1; i <= 24; i++) {
      const selector = this.registrationPage.getRecoveryWordSelector(i);
      const wordElement = await this.window.getByTestId(selector);
      this.organizationRecoveryWords[userIndex][i] = await wordElement.inputValue();
    }
  }

  // Method to fill a missing recovery phrase word by index
  async fillRecoveryPhraseWordForUser(userIndex, index, word) {
    const selector = this.registrationPage.getRecoveryWordSelector(index);
    await this.fill(selector, word);
  }

  // Method to fill in all missing recovery phrase words based on the saved recoveryPhraseWords
  async fillAllMissingRecoveryPhraseWordsForUser(userIndex) {
    for (let i = 1; i <= 24; i++) {
      const selector = this.registrationPage.getRecoveryWordSelector(i);
      const wordElement = await this.window.getByTestId(selector);
      const value = await wordElement.inputValue();
      if (!value) {
        const word = this.organizationRecoveryWords[userIndex][i];
        if (word) {
          await this.fillRecoveryPhraseWordForUser(userIndex, i, word);
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

    // Update organizationRecoveryWords for user 0 (admin user)
    this.organizationRecoveryWords[0] = {};
    words.forEach((word, index) => {
      this.organizationRecoveryWords[0][index + 1] = word; // Using 1-based index for recovery words
    });
  }

  async clickOnContactListButton() {
    await this.click(this.contactListButton);
  }

  async isContactListButtonVisible() {
    return await this.isElementVisible(this.contactListButton);
  }

  async clickOnEditNicknameOrganizationButton() {
    await this.click(this.editNicknameOrganizationButtonSelector);
  }

  async fillInNewOrganizationNickname(nickname) {
    await this.fill(this.editOrganizationNicknameInputSelector, nickname);
  }

  async getOrganizationNicknameText() {
    return await this.getText(this.organizationNicknameTextSelector);
  }

  async editOrganizationNickname(newNickname) {
    let retries = 0;
    const maxRetries = 10;

    while (retries < maxRetries) {
      const currentNickname = await this.getOrganizationNicknameText();
      if (currentNickname !== newNickname) {
        await this.clickOnEditNicknameOrganizationButton();
        await new Promise(resolve => setTimeout(resolve, 500));
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
    await this.click(this.deleteNextButtonSelector);
  }

  async isDeleteNextButtonVisible() {
    return await this.isElementVisible(this.deleteNextButtonSelector);
  }

  async getFirstPublicKeyByEmail(email) {
    return await getFirstPublicKeyByEmail(email);
  }

  async getUserIdByEmail(email) {
    return await getUserIdByEmail(email);
  }

  async isKeyDeleted(publicKey) {
    return await isKeyDeleted(publicKey);
  }

  async findNewKey(userId) {
    return await findNewKey(userId);
  }

  async getAllTransactionIdsForUserObserver(userId) {
    return await getAllTransactionIdsForUserObserver(userId);
  }

  async clickOnAddObserverButton() {
    await this.click(this.addObserverButtonSelector);
  }

  async clickOnAddUserButtonForObserver() {
    await this.click(this.addUserButtonSelector);
  }

  async clickOnUserOfObserverList(index) {
    await this.click(this.userListIndexSelector + index);
  }

  async getUserOfObserverList(index) {
    return await this.getText(this.userListIndexSelector + index);
  }

  /**
   * Opens the date picker.
   */
  async openDatePicker() {
    await this.window.click(`[data-test="dp-input"]`);
    await this.window.waitForSelector('.dp__instance_calendar');
  }

  /**
   * Switches to the time picker within the date picker.
   */
  async switchToTimePicker() {
    await this.click(this.timePickerIconSelector);
    await this.window.waitForSelector('.dp__time_input');
  }

  /**
   * Moves the time ahead by the specified number of seconds, handling minute and hour overflow.
   *
   * @param seconds - The number of seconds to move ahead.
   */
  async moveTimeAheadBySeconds(seconds) {
    const increment = async (selector, count) => {
      if (count > 0) {
        for (let i = 0; i < count; i++) {
          await this.window.click(selector);
        }
      } else if (count < 0) {
        for (let i = 0; i > count; i--) {
          await this.window.click(selector.replace('Increment', 'Decrement'));
        }
      }
    };
    // Get the current time values
    const currentSeconds = parseInt(
      await this.window.textContent(this.secondsOverlayButtonSelector),
    );
    const currentMinutes = parseInt(
      await this.window.textContent(this.minutesOverlayButtonSelector),
    );
    const currentHours = parseInt(await this.window.textContent(this.hoursOverlayButtonSelector));

    // Calculate the new time values
    const totalSeconds = currentSeconds + seconds;
    const extraMinutes = Math.floor(totalSeconds / 60);
    const newSeconds = (totalSeconds + 60) % 60;

    const totalMinutes = currentMinutes + extraMinutes;
    const extraHours = Math.floor(totalMinutes / 60);
    const newMinutes = (totalMinutes + 60) % 60;

    const newHours = (currentHours + extraHours + 24) % 24;

    await increment(this.incrementHourButtonSelector, newHours - currentHours);
    await increment(this.incrementMinutesButtonSelector, newMinutes - currentMinutes);
    await increment(this.incrementSecondsButtonSelector, newSeconds - currentSeconds);
  }

  /**
   * Opens the date picker, switches to the time picker, and moves the time ahead by 30 seconds.
   */
  async setDateTimeAheadBy(time = 30) {
    await this.openDatePicker();
    await this.switchToTimePicker();
    await this.moveTimeAheadBySeconds(time);
  }

  async addComplexKeyAccountForTransactions() {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await this.transactionPage.clickOnCreateAccountTransaction();
    await this.transactionPage.fillInInitialFunds('100');
    await this.transactionPage.clickOnComplexTab();
    await this.transactionPage.clickOnCreateNewComplexKeyButton();

    //add account#1
    const publicKey = await this.getFirstPublicKeyByEmail(this.users[0].email);
    await this.transactionPage.addPublicKeyAtDepth('0', publicKey);

    //add threshold
    await this.transactionPage.addThresholdKeyAtDepth('0');

    //add account#2
    const publicKey2 = await this.getFirstPublicKeyByEmail(this.users[1].email);
    await this.transactionPage.addPublicKeyAtDepth('0-1', publicKey2);

    //add account#3
    const publicKey3 = await this.getFirstPublicKeyByEmail(this.users[2].email);
    await this.transactionPage.addPublicKeyAtDepth('0-1', publicKey3);

    await this.transactionPage.clickOnDoneButtonForComplexKeyCreation();
    await this.transactionPage.clickOnSignAndSubmitButton();
    await this.transactionPage.clickSignTransactionButton();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnSignTransactionButton();
    const validStart = await this.getValidStart();
    await waitForValidStart(validStart);
    const transactionResponse =
      await this.transactionPage.mirrorGetTransactionResponse(transactionId);
    this.complexAccountId.push(transactionResponse.transactions[0].entity_id);
  }

  async logInAndSignTransactionByAllUsers(encryptionPassword, txId) {
    for (let i = 1; i < this.users.length; i++) {
      console.log(`Signing transaction for user ${i}`);
      const user = this.users[i];
      await this.signInOrganization(user.email, user.password, encryptionPassword);
      await this.transactionPage.clickOnTransactionsMenuButton();
      await this.clickOnReadyToSignTab();
      await this.clickOnSubmitSignButtonByTransactionId(txId);
      await this.clickOnSignTransactionButton();

      await this.logoutFromOrganization();
    }
  }

  async addComplexKeyAccountWithNestedThresholds(users = 99) {
    // Ensure we have enough users
    if (users < 3) {
      throw new Error('You need at least 3 users to proceed with this function.');
    }

    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await this.transactionPage.clickOnCreateAccountTransaction();
    await this.transactionPage.clickOnComplexTab();
    await this.transactionPage.clickOnCreateNewComplexKeyButton();

    // Start at depth 0 for the major threshold
    let currentDepth = '0';

    // Step 1: Create Primary and Secondary thresholds
    await this.transactionPage.addThresholdKeyAtDepth(currentDepth);
    await this.transactionPage.addThresholdKeyAtDepth(currentDepth);
    // Select 1 of 2 for the major threshold
    await this.selectOptionByValue(
      this.transactionPage.selectThresholdValueByIndex + currentDepth,
      '1',
    );

    // Step 2: Calculate how to divide the users between Primary & Secondary
    const primaryThresholds = Math.ceil((2 / 3) * (users / 3)); // Approximately 2/3 of the thresholds for Primary
    const secondaryThresholds = Math.floor((1 / 3) * (users / 3)); // Approximately 1/3 of the thresholds for Secondary

    let userIndex = 0;

    // Adding thresholds and public keys under "Primary"
    for (let i = 0; i < primaryThresholds; i++) {
      // Add a threshold under "Primary"
      await this.transactionPage.addThresholdKeyAtDepth(`0-0`);

      // Add 3 public keys to this threshold
      for (let j = 0; j < 3; j++) {
        const publicKey = await this.getFirstPublicKeyByEmail(
          this.users[userIndex % this.users.length].email,
        );
        await this.transactionPage.addPublicKeyAtDepth(`0-0-${i}`, publicKey);
        userIndex++;
      }

      // Changing the threshold to be 1 of 3
      await this.selectOptionByValue(
        this.transactionPage.selectThresholdValueByIndex + `0-0-${i}`,
        '1',
      );
    }

    // Selecting the threshold to be the half of the total number of thresholds
    const primaryThresholdValue = Math.max(Math.floor(primaryThresholds / 2), 1).toString();
    await this.selectOptionByValue(
      this.transactionPage.selectThresholdValueByIndex + `0-0`,
      primaryThresholdValue,
    );

    // Adding thresholds and public keys under "Secondary"
    for (let i = 0; i < secondaryThresholds; i++) {
      // Add a threshold under "Secondary"
      await this.transactionPage.addThresholdKeyAtDepth(`0-1`);

      // Add 3 public keys to this threshold
      for (let j = 0; j < 3; j++) {
        const publicKey = await this.getFirstPublicKeyByEmail(
          this.users[userIndex % this.users.length].email,
        );
        await this.transactionPage.addPublicKeyAtDepth(`0-1-${i}`, publicKey);
        userIndex++;
      }

      // Changing the threshold to be 1 of 3
      await this.selectOptionByValue(
        this.transactionPage.selectThresholdValueByIndex + `0-1-${i}`,
        '1',
      );
    }

    // Selecting the threshold to be the half of the total number of thresholds
    const secondaryThresholdValue = Math.max(Math.floor(secondaryThresholds / 2), 1).toString();
    await this.selectOptionByValue(
      this.transactionPage.selectThresholdValueByIndex + `0-1`,
      secondaryThresholdValue,
    );

    // Step 3: Complete the transaction
    await this.transactionPage.clickOnDoneButtonForComplexKeyCreation();
    await this.transactionPage.fillInInitialFunds('100');
    await this.transactionPage.clickOnSignAndSubmitButton();
    await this.transactionPage.clickSignTransactionButton();

    // Retrieve and store the transaction ID
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnSignTransactionButton();
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Store the complex account ID
    const transactionResponse =
      await this.transactionPage.mirrorGetTransactionResponse(transactionId);
    this.complexAccountId.push(transactionResponse.transactions[0].entity_id);
  }

  async createAccount(timeForExecution = 60, numberOfObservers = 1, isSignRequired = true) {
    let selectedObservers = [];
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await this.transactionPage.clickOnCreateAccountTransaction();
    await this.setDateTimeAheadBy(timeForExecution);

    for (let i = 0; i < numberOfObservers; i++) {
      await this.clickOnAddObserverButton();
      const observerEmail = await this.getUserOfObserverList(0);
      selectedObservers.push(observerEmail);
      await this.clickOnUserOfObserverList(0);
      await this.clickOnAddUserButtonForObserver();
    }

    await this.transactionPage.clickOnSignAndSubmitButton();
    await this.transactionPage.clickSignTransactionButton();
    if (isSignRequired) {
      await this.clickOnSignTransactionButton();
    }
    const txId = await this.getTransactionDetailsId();
    const validStart = await this.getValidStart();
    return {
      txId,
      selectedObservers: numberOfObservers === 1 ? selectedObservers[0] : selectedObservers,
      validStart,
    };
  }

  async clickOnSignTransactionButton() {
    await this.click(this.signTransactionButtonSelector, null, 5000);
  }

  async isSignTransactionButtonVisible() {
    return await this.isElementVisible(this.signTransactionButtonSelector);
  }

  async getTransactionDetailsId() {
    return await this.getText(this.transactionDetailsIdSelector, null, 5000);
  }

  async getValidStart() {
    return await this.getText(this.transactionValidStartSelector);
  }

  getComplexAccountId() {
    return this.complexAccountId[0];
  }

  async clickOnReadyToSignTab() {
    await this.click(this.readyToSignTabSelector);
  }

  async clickOnInProgressTab() {
    await this.click(this.inProgressTabSelector);
  }

  async clickOnReadyForExecutionTab() {
    await this.click(this.readyForExecutionTabSelector);
  }

  async clickOnHistoryTab() {
    await this.click(this.historyTabSelector);
  }

  async startNewTransaction(transactionTypeFunction) {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await transactionTypeFunction();
  }

  async processTransaction(isSignRequiredFromCreator = false) {
    await this.transactionPage.clickOnSignAndSubmitButton();
    await this.transactionPage.clickSignTransactionButton();

    const txId = await this.getTransactionDetailsId();
    const validStart = await this.getValidStart();

    if (isSignRequiredFromCreator) {
      await this.clickOnSignTransactionButton();
    }

    return { txId, validStart };
  }

  async updateAccount(accountId, memo, timeForExecution = 10, isSignRequiredFromCreator = false) {
    await this.startNewTransaction(() => this.transactionPage.clickOnUpdateAccountTransaction());
    await this.setDateTimeAheadBy(timeForExecution);

    await this.transactionPage.fillInUpdatedAccountId(accountId);
    await this.transactionPage.fillInMemoUpdate(memo);
    await this.transactionPage.fillInTransactionMemoUpdate('tx memo update');

    await this.transactionPage.waitForElementPresentInDOM(
      this.transactionPage.updateAccountIdFetchedDivSelector,
      30000,
    );

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async transferAmountBetweenAccounts(
    fromAccountId,
    amount,
    timeForExecution = 10,
    isSignRequiredFromCreator = false,
  ) {
    await this.startNewTransaction(() => this.transactionPage.clickOnTransferTokensTransaction());
    await this.setDateTimeAheadBy(timeForExecution);

    await this.fill(this.transactionPage.transferFromAccountIdInputSelector, fromAccountId);
    await this.transactionPage.fillInTransferAmountFromAccount(amount);

    const payerAccountId = await this.getTextFromInputField(
      this.transactionPage.payerDropdownSelector,
    );
    await this.transactionPage.fillInTransferToAccountId(payerAccountId);

    await this.transactionPage.clickOnAddTransferFromButton();
    await this.transactionPage.fillInTransferAmountToAccount(amount);
    await this.transactionPage.clickOnAddTransferToButton();

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async approveAllowance(
    ownerAccountId,
    amount,
    timeForExecution,
    isSignRequiredFromCreator = false,
  ) {
    await this.startNewTransaction(() =>
      this.transactionPage.clickOnApproveAllowanceTransaction(false),
    );
    await this.setDateTimeAheadBy(timeForExecution);

    await this.transactionPage.fillInAllowanceOwner(ownerAccountId);
    await this.transactionPage.fillInAllowanceAmount(amount);
    await this.transactionPage.fillInSpenderAccountId(
      await this.getTextFromInputField(this.transactionPage.payerDropdownSelector),
    );

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async updateSystemFile(fileId, timeForExecution = 10, isSignRequiredFromCreator = false) {
    await this.startNewTransaction(async () => {
      await this.transactionPage.clickOnFileServiceLink();
      await this.transactionPage.clickOnUpdateFileSublink();
    });
    await this.transactionPage.fillInPayerAccountId('0.0.2');
    await this.setDateTimeAheadBy(timeForExecution);
    await this.transactionPage.fillInFileIdForUpdate(fileId);

    const fileMappings = {
      '0.0.101': {
        encodeFunction: encodeNodeAddressBook,
        inputFile: 'data/101.json',
        outputFile: 'data/node-address-book.bin',
        binFile: 'node-address-book.bin',
      },
      '0.0.102': {
        encodeFunction: encodeNodeAddressBook,
        inputFile: 'data/102.json',
        outputFile: 'data/node-details.bin',
        binFile: 'node-details.bin',
      },
      '0.0.111': {
        encodeFunction: encodeFeeSchedule,
        inputFile: 'data/feeSchedules.json',
        outputFile: 'data/fee-schedules.bin',
        binFile: 'fee-schedules.bin',
        specialProcessing: true, // This is a huge file, so we need to handle it differently due to transaction group
      },
      '0.0.112': {
        encodeFunction: encodeExchangeRates,
        inputFile: 'data/exchangeRates.json',
        outputFile: 'data/exchange-rates.bin',
        binFile: 'exchange-rates.bin',
      },
      '0.0.121': {
        encodeFunction: encodeServicesConfigurationList,
        inputFile: 'data/application.properties',
        outputFile: 'data/application-properties.bin',
        binFile: 'application-properties.bin',
      },
      '0.0.122': {
        encodeFunction: encodeServicesConfigurationList,
        inputFile: 'data/api-permission.properties',
        outputFile: 'data/api-permission-properties.bin',
        binFile: 'api-permission-properties.bin',
      },
      '0.0.123': {
        encodeFunction: encodeThrottleDefinitions,
        inputFile: 'data/123.json',
        outputFile: 'data/throttles.bin',
        binFile: 'throttles.bin',
      },
    };

    const fileInfo = fileMappings[fileId];

    if (!fileInfo) {
      throw new Error(`Unsupported fileId: ${fileId}`);
    }

    await fileInfo.encodeFunction(fileInfo.inputFile, fileInfo.outputFile);
    await this.transactionPage.uploadSystemFile(fileInfo.binFile);

    let txId, validStart;

    if (fileInfo.specialProcessing) {
      // Special processing for large files
      // It does not go through the standard transaction processing
      // Instead it goes into a transaction group
      await this.transactionPage.clickOnSignAndSubmitButton();
      await this.transactionPage.clickSignTransactionButton();
      const txIdArray = await this.getGroupTransactionIdText();
      const validStartArray = await this.getGroupValidStartText();
      txId = txIdArray[txIdArray.length - 1]; // Get the last item in the array
      validStart = validStartArray[0];
      await this.clickOnSignAllTransactionsButton();
    } else {
      // Standard transaction processing
      ({ txId, validStart } = await this.processTransaction(isSignRequiredFromCreator));
    }

    return { txId, validStart };
  }

  /**
   * Checks if a file from the application is identical to the corresponding file in the data folder.
   * @param {string} fileId - The ID of the file to read and compare.
   * @returns {boolean} - Returns true if files are identical, or false if there are differences.
   */
  async areFilesIdentical(fileId) {
    // Read the file content from the application
    const textFromField = await this.transactionPage.readFile(fileId);
    if (!textFromField || textFromField.trim() === '') {
      throw new Error(`No data returned from application for fileId ${fileId}`);
    }

    // Mapping of file IDs to data files and file types
    const fileMappings = {
      '0.0.101': { path: 'data/101.json', type: 'json', keysToIgnore: [] },
      '0.0.102': { path: 'data/102.json', type: 'json', keysToIgnore: [] },
      '0.0.111': { path: 'data/feeSchedules.json', type: 'json', keysToIgnore: [] },
      '0.0.112': {
        path: 'data/exchangeRates.json',
        type: 'json',
        keysToIgnore: ['exchangeRateInCents'],
        normalizer: normalizeExchangeRateData,
      },
      '0.0.121': { path: 'data/application.properties', type: 'properties', keysToIgnore: [] },
      '0.0.122': { path: 'data/api-permission.properties', type: 'properties', keysToIgnore: [] },
      '0.0.123': {
        path: 'data/123.json',
        type: 'json',
        keysToIgnore: [],
        normalizer: normalizeThrottleData,
      },
    };

    const fileInfo = fileMappings[fileId];

    if (!fileInfo) {
      throw new Error(`Unsupported fileId: ${fileId}`);
    }

    // Read the local file content
    const localFileContent = fs.readFileSync(fileInfo.path, 'utf8');

    let localData, remoteData;

    // Parse the files based on their type
    if (fileInfo.type === 'json') {
      // Parse local JSON file
      try {
        localData = JSON.parse(localFileContent);
      } catch (error) {
        throw new Error(`Failed to parse local JSON file ${fileInfo.path}: ${error.message}`);
      }

      // Parse remote JSON data from application
      try {
        remoteData = JSON.parse(textFromField);
      } catch (error) {
        throw new Error(`Failed to parse remote JSON data for fileId ${fileId}: ${error.message}`);
      }
    } else if (fileInfo.type === 'properties') {
      // Parse local properties file into an object
      localData = parsePropertiesContent(localFileContent);

      // Parse remote properties content into an object
      remoteData = parsePropertiesContent(textFromField);
    } else {
      throw new Error(`Unsupported file type for fileId ${fileId}`);
    }

    const keysToIgnore = fileInfo.keysToIgnore || [];

    // Apply normalizer if present
    if (fileInfo.normalizer) {
      localData = fileInfo.normalizer(localData);
      remoteData = fileInfo.normalizer(remoteData);
    }

    // Compare the two data objects
    const differences = compareJsonFiles(localData, remoteData, keysToIgnore);

    if (differences === null) {
      console.log(`The files for fileId ${fileId} are identical.`);
      return true;
    } else {
      console.log(`The files for fileId ${fileId} are not identical.`);
      console.log('Differences:', JSON.stringify(differences, null, 2));
      return false;
    }
  }

  async getGroupTransactionIdText() {
    return await this.getText(this.transactionIdInGroupSelector);
  }

  async getGroupValidStartText() {
    return await this.getText(this.validStartTimeInGroupSelector);
  }

  async clickOnSignAllTransactionsButton() {
    await this.click(this.signAllTransactionsButtonSelector);
  }

  async getReadyForSignTransactionIdByIndex(index) {
    return await this.getText(this.readyForSignTransactionIdIndexSelector + index);
  }

  async getReadyForSignTransactionTypeByIndex(index) {
    return await this.getText(this.readyForSignTransactionTypeIndexSelector + index);
  }

  async getReadyForSignValidStartByIndex(index) {
    return await this.getText(this.readyForSignValidStartIndexSelector + index);
  }

  async isReadyForSignSubmitSignButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.readyForSignSubmitSignButtonIndexSelector + index);
  }

  async clickOnSubmitSignButtonByIndex(index) {
    await this.click(this.readyForSignSubmitSignButtonIndexSelector + index, null, 5000);
  }

  async getInProgressTransactionIdByIndex(index) {
    return await this.getText(this.inProgressTransactionIdIndexSelector + index);
  }

  async getInProgressTransactionTypeByIndex(index) {
    return await this.getText(this.inProgressTransactionTypeIndexSelector + index);
  }

  async getInProgressValidStartByIndex(index) {
    return await this.getText(this.inProgressValidStartIndexSelector + index);
  }

  async isInProgressDetailsButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.inProgressDetailsButtonIndexSelector + index);
  }

  async getReadyForExecutionTransactionIdByIndex(index) {
    return await this.getText(this.readyForExecutionTransactionIdIndexSelector + index);
  }

  async getReadyForExecutionTransactionTypeByIndex(index) {
    return await this.getText(this.readyForExecutionTransactionTypeIndexSelector + index);
  }

  async getReadyForExecutionValidStartByIndex(index) {
    return await this.getText(this.readyForExecutionValidStartIndexSelector + index);
  }

  async isReadyForExecutionDetailsButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.readyForExecutionDetailsButtonIndexSelector + index);
  }

  async clickOnReadyForExecutionDetailsButtonByIndex(index) {
    await this.click(this.readyForExecutionDetailsButtonIndexSelector + index);
  }

  async getHistoryTransactionIdByIndex(index) {
    return await this.getText(this.historyTransactionIdIndexSelector + index);
  }

  async getHistoryTransactionTypeByIndex(index) {
    return await this.getText(this.historyTransactionTypeIndexSelector + index);
  }

  async getHistoryTransactionStatusByIndex(index) {
    return await this.getText(this.historyTransactionStatusIndexSelector + index);
  }

  async getHistoryTransactionCreatedAtByIndex(index) {
    return await this.getText(this.historyCreatedAtIndexSelector + index);
  }

  async isHistoryDetailsButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.historyDetailsButtonIndexSelector + index);
  }

  async clickOnHistoryDetailsButtonByIndex(index) {
    await this.click(this.historyDetailsButtonIndexSelector + index);
  }

  async getTransactionDetails(
    transactionId,
    transactionIdIndexSelector,
    getTransactionIdByIndex,
    getTransactionTypeByIndex,
    getValidStartByIndex,
    getDetailsButtonVisibleByIndex,
    additionalFields = [],
    maxRetries = 10,
    retryDelay = 500,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(transactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        const id = await getTransactionIdByIndex.call(this, i);
        if (id === transactionId) {
          const transactionType = await getTransactionTypeByIndex.call(this, i);
          const validStart = await getValidStartByIndex.call(this, i);
          const detailsButton = await getDetailsButtonVisibleByIndex.call(this, i);

          const additionalData = {};
          for (const field of additionalFields) {
            additionalData[field.name] = await field.getter.call(this, i);
          }

          return {
            transactionId: id,
            transactionType,
            validStart,
            detailsButton,
            ...additionalData,
          };
        }
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    return null;
  }

  async getReadyForSignTransactionDetails(transactionId) {
    return await this.getTransactionDetails(
      transactionId,
      this.readyForSignTransactionIdIndexSelector,
      this.getReadyForSignTransactionIdByIndex,
      this.getReadyForSignTransactionTypeByIndex,
      this.getReadyForSignValidStartByIndex,
      this.isReadyForSignSubmitSignButtonVisibleByIndex,
      [{ name: 'isSignButtonVisible', getter: this.isReadyForSignSubmitSignButtonVisibleByIndex }],
    );
  }

  async getInProgressTransactionDetails(transactionId) {
    return await this.getTransactionDetails(
      transactionId,
      this.inProgressTransactionIdIndexSelector,
      this.getInProgressTransactionIdByIndex,
      this.getInProgressTransactionTypeByIndex,
      this.getInProgressValidStartByIndex,
      this.isInProgressDetailsButtonVisibleByIndex,
      [],
    );
  }

  async getReadyForExecutionTransactionDetails(transactionId) {
    return await this.getTransactionDetails(
      transactionId,
      this.readyForExecutionTransactionIdIndexSelector,
      this.getReadyForExecutionTransactionIdByIndex,
      this.getReadyForExecutionTransactionTypeByIndex,
      this.getReadyForExecutionValidStartByIndex,
      this.isReadyForExecutionDetailsButtonVisibleByIndex,
      [],
    );
  }

  async getHistoryTransactionDetails(transactionId) {
    return await this.getTransactionDetails(
      transactionId,
      this.historyTransactionIdIndexSelector,
      this.getHistoryTransactionIdByIndex,
      this.getHistoryTransactionTypeByIndex,
      this.getHistoryTransactionCreatedAtByIndex,
      this.isHistoryDetailsButtonVisibleByIndex,
      [{ name: 'status', getter: this.getHistoryTransactionStatusByIndex }],
    );
  }

  async clickOnSubmitSignButtonByTransactionId(transactionId, maxRetries = 10, retryDelay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(this.readyForSignTransactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        const id = await this.getReadyForSignTransactionIdByIndex(i);
        if (id === transactionId) {
          await this.clickOnSubmitSignButtonByIndex(i);
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  async clickOnReadyForExecutionDetailsButtonByTransactionId(
    transactionId,
    maxRetries = 10,
    retryDelay = 1000,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(this.readyForExecutionTransactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        const id = await this.getReadyForExecutionTransactionIdByIndex(i);
        if (id === transactionId) {
          await this.clickOnReadyForExecutionDetailsButtonByIndex(i);
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  async clickOnHistoryDetailsButtonByTransactionId(
    transactionId,
    maxRetries = 10,
    retryDelay = 1000,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(this.historyTransactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        const id = await this.getHistoryTransactionIdByIndex(i);
        if (id === transactionId) {
          await this.clickOnHistoryDetailsButtonByIndex(i);
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  async isTransactionIdVisibleInProgress(transactionId, attempts = 10) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const count = await this.countElements(this.inProgressTransactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        if ((await this.getInProgressTransactionIdByIndex(i)) === transactionId) {
          return true;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  async isTransactionIdVisibleReadyForExecution(transactionId, attempts = 10) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const count = await this.countElements(this.readyForExecutionTransactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        if ((await this.getReadyForExecutionTransactionIdByIndex(i)) === transactionId) {
          return true;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  async getOrCreateUpdateTransaction(
    accountId,
    memo,
    timeForExecution = 100,
    isSignRequiredFromCreator = true,
  ) {
    if (this.transactions.length > 0) {
      console.log('Reusing existing transaction');
      return this.transactions[0];
    }

    console.log('Creating new transaction');
    const { txId, validStart } = await this.updateAccount(
      accountId,
      memo,
      timeForExecution,
      isSignRequiredFromCreator,
    );
    const transactionDetails = { txId, validStart };
    this.transactions.push(transactionDetails);
    return transactionDetails;
  }

  /**
   * Verifies if a specific transaction stage is completed.
   *
   * @param {number} stageIndex - The index of the stage to verify.
   * @returns {Promise<boolean>} - True if the stage is completed, false if active.
   */
  async isTransactionStageCompleted(stageIndex) {
    const bubbleContent = await this.getInnerContent(this.stageBubbleIndexSelector + stageIndex);
    return bubbleContent.trim().includes('bi-check-lg');
  }

  async isSecondSignerCheckmarkVisible() {
    return await this.isElementVisible(this.secondSignerCheckmarkSelector);
  }

  async getObserverEmail(index) {
    return await this.getText(this.observerIndexSelector + index);
  }

  async getNotificationNumberText() {
    return await this.getText(this.spanNotificationNumberSelector);
  }

  async isNotificationNumberVisible() {
    return await this.isElementVisible(this.spanNotificationNumberSelector);
  }

  async createNotificationForUser(firstUser, secondUser, globalCredentials) {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.logoutFromOrganization();
    await this.signInOrganization(firstUser.email, firstUser.password, globalCredentials.password);
    await this.updateAccount(this.getComplexAccountId(), 'update', 10, false);
    await this.settingsPage.clickOnSettingsButton();
    await this.logoutFromOrganization();
    await this.signInOrganization(
      secondUser.email,
      secondUser.password,
      globalCredentials.password,
    );
  }

  async ensureNotificationStateForUser(firstUser, secondUser, globalCredentials) {
    let notificationStatus = await getLatestNotificationStatusByEmail(secondUser.email);

    // If there's no notification or the latest is read, create a new one
    if (!notificationStatus || notificationStatus.isRead === true) {
      await this.createNotificationForUser(firstUser, secondUser, globalCredentials);
    }
    // If the notification exists and is unread, nothing more needs to be done
  }

  async clickOnNextTransactionButton() {
    await this.click(this.nextTransactionButtonSelector);
  }

  async isNextTransactionButtonVisible() {
    return await this.isElementVisible(this.nextTransactionButtonSelector);
  }
}

module.exports = OrganizationPage;
