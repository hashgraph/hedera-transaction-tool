import { queryDatabase, queryPostgresDatabase, createTestUser } from '../utils/databaseUtil';
import { generateMnemonic } from '../utils/keyUtil';
const BasePage = require('./BasePage');
const RegistrationPage = require('./RegistrationPage');
const SettingsPage = require('./SettingsPage');
const TransactionPage = require('./TransactionPage');
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
    this.transactions = []; // List to store transactions
    this.organizationRecoveryWords = [];
    this.badOrganizationList = [];
    this.complexAccountId = [];
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
  editNicknameOrganizationButtonSelector = 'button-edit-nickname';
  closeErrorModalButtonSelector = 'button-close-modal';
  logoutButtonSelector = 'button-logout';
  contactListButton = 'button-contact-list';
  deleteNextButtonSelector = 'button-delete-next';
  addApproverButtonSelector = 'button-add-approver';
  addObserverButtonSelector = 'button-add-observer';
  selectUserButtonSelector = 'button-select-user';
  addUserButtonSelector = 'button-add-user';
  doneButtonSelector = 'button-complex-key-done';
  timePickerIconSelector = '.dp--tp-wrap button[aria-label="Open time picker"]';
  incrementSecondsButtonSelector = 'button[aria-label="Increment seconds"]';
  incrementMinutesButtonSelector = 'button[aria-label="Increment minutes"]';
  incrementHourButtonSelector = 'button[aria-label="Increment hours"]';
  secondsOverlayButtonSelector = 'button[aria-label="Open seconds overlay"]';
  minutesOverlayButtonSelector = 'button[aria-label="Open minutes overlay"]';
  hoursOverlayButtonSelector = 'button[aria-label="Open hours overlay"]';
  insertComplexKeyButtonSelector = 'button-insert-public-key';
  signTransactionButtonSelector = 'button-sign-org-transaction';

  // Inputs
  organizationNicknameInputSelector = 'input-organization-nickname';
  serverUrlInputSelector = 'input-server-url';
  encryptPasswordInputSelector = 'input-encrypt-password';
  emailForOrganizationInputSelector = 'input-login-email-for-organization';
  passwordForOrganizationInputSelector = 'input-login-password-for-organization';
  editOrganizationNicknameInputSelector = 'input-edit-nickname';
  inputPublicComplexKeySelector = 'input-complex-public-key';

  // Texts
  organizationErrorMessageSelector = 'p-organization-error-message';
  organizationNicknameTextSelector = 'span-organization-nickname';
  firstUserOfListSelector = 'span-email-0';
  transactionDetailsIdSelector = 'p-transaction-details-id';
  transactionValidStartSelector = 'p-transaction-details-valid-start';
  createdStageSelector = 'stepper-title-0';
  collectingSignaturesSelector = 'stepper-title-1';
  awaitingExecutionSelector = 'stepper-title-2';
  executedSelector = 'stepper-title-3';
  firstSignerThresholdPublicKeySelector = 'span-public-key-0-0';
  secondSignerThresholdPublicKeySelector = 'span-public-key-1-0';
  thirdSignerThresholdPublicKeySelector = 'span-public-key-1-1';
  firstSignerCheckmarkSelector = 'span-checkmark-public-key-0-0';
  secondSignerCheckmarkSelector = 'span-checkmark-public-key-1-0';
  thirdSignerCheckmarkSelector = 'span-checkmark-public-key-1-1';

  // Indexes
  modeSelectionIndexSelector = 'dropdown-item-';
  firstMissingKeyIndexSelector = 'cell-index-missing-0';
  readyForReviewTransactionIdIndexSelector = 'td-review-transaction-id-';
  readyForReviewTransactionTypeIndexSelector = 'td-review-transaction-type-';
  readyForReviewValidStartIndexSelector = 'td-review-transaction-valid-start-';
  readyForReviewSubmitApprovalButtonIndexSelector = 'button-review-transaction-approve-';
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

      await setupEnvironmentForTransactions(window, privateKey);
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

  async recoverPrivateKey(window) {
    // for the purposes of settings tests we are recovering User#1 which has PRIVATE_KEY_2 in the database
    await setupEnvironmentForTransactions(window, process.env.PRIVATE_KEY_2);
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

  findUserAndReturnPassword(email) {
    const user = this.users.find(user => user.email === email);
    if (!user) {
      throw new Error(`User with email ${email} is not defined`);
    }
    return user.password;
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

  /**
   * Retrieves the public key for a user identified by the given email.
   *
   * @param {string} email - The email of the user whose public key is to be retrieved.
   * @return {Promise<string|null>} A promise that resolves to the public key if found, or null if not found.
   * @throws {Error} If there is an error executing the query.
   */
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

  /**
   * Retrieves the user ID for a user identified by the given email.
   *
   * @param {string} email - The email of the user whose ID is to be retrieved.
   * @return {Promise<number|null>} A promise that resolves to the user ID if found, or null if not found.
   * @throws {Error} If there is an error executing the query.
   */
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

  /**
   * Checks if the given public key is marked as deleted.
   *
   * @param {string} publicKey - The public key to check.
   * @return {Promise<boolean>} A promise that resolves to true if the key is deleted, or false if not.
   * @throws {Error} If there is an error executing the query.
   */
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

  /**
   * Finds a new public key for the user identified by the given user ID, where the key index is 0 and the key is not deleted.
   *
   * @param {number} userId - The ID of the user whose new public key is to be found.
   * @return {Promise<boolean>} A promise that resolves to true if a new key is found, or false if not.
   * @throws {Error} If there is an error executing the query.
   */
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

  //TODO - Align the below methods based on new implementation

  // async clickOnAddApproverButton() {
  //   await this.clickByTestId(this.addApproverButtonSelector);
  // }
  //
  // async clickOnAddObserverButton() {
  //   await this.clickByTestId(this.addObserverButtonSelector);
  // }
  //
  // async clickOnSelectUserButton() {
  //   await this.clickByTestId(this.selectUserButtonSelector);
  // }
  //
  // async clickOnAddUserButton() {
  //   await this.clickByTestIdWithIndex(this.addUserButtonSelector);
  // }
  //
  // async clickOnDoneButton() {
  //   await this.clickByTestId(this.doneButtonSelector);
  // }
  //
  // async clickOnFirstUserOfList() {
  //   await this.clickByTestIdWithIndex(this.firstUserOfListSelector);
  // }
  //
  // async getFirstUserOfList() {
  //   return await this.getTextByTestIdWithIndex(this.firstUserOfListSelector);
  // }

  /**
   * Opens the date picker.
   */
  async openDatePicker() {
    await this.window.click(`.dp__input_wrap`);
    await this.window.waitForSelector('.dp__instance_calendar');
  }

  /**
   * Switches to the time picker within the date picker.
   */
  async switchToTimePicker() {
    await this.window.click(this.timePickerIconSelector);
    await this.window.waitForSelector('.dp__time_input');
  }

  /**
   * Moves the time ahead by the specified number of seconds, handling minute and hour overflow.
   *
   * @param {number} seconds - The number of seconds to move ahead.
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

    await increment(this.incrementSecondsButtonSelector, newSeconds - currentSeconds);
    await increment(this.incrementMinutesButtonSelector, newMinutes - currentMinutes);
    await increment(this.incrementHourButtonSelector, newHours - currentHours);
  }

  /**
   * Opens the date picker, switches to the time picker, and moves the time ahead by 30 seconds.
   */
  async setDateTimeAheadBy(time = 30) {
    await this.openDatePicker();
    await this.switchToTimePicker();
    await this.moveTimeAheadBySeconds(time);
  }

  async fillInComplexPublicKey(publicKey) {
    await this.fillByTestId(this.inputPublicComplexKeySelector, publicKey);
  }

  async clickOnInsertComplexKeyButton() {
    await this.clickByTestId(this.insertComplexKeyButtonSelector);
  }

  async addComplexKeyAccountForTransactions() {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await this.transactionPage.clickOnCreateAccountTransaction();
    await this.transactionPage.clickOnComplexTab();
    await this.transactionPage.clickOnCreateNewComplexKeyButton();

    //add account#1
    const publicKey = await this.getPublicKeyByEmail(this.users[0].email);
    await this.transactionPage.addPublicKeyAtDepth('0', publicKey);

    //add threshold
    await this.transactionPage.addThresholdKeyAtDepth('0');

    //add account#2
    const publicKey2 = await this.getPublicKeyByEmail(this.users[1].email);
    await this.transactionPage.addPublicKeyAtDepth('0-1', publicKey2);

    //add account#3
    const publicKey3 = await this.getPublicKeyByEmail(this.users[2].email);
    await this.transactionPage.addPublicKeyAtDepth('0-1', publicKey3);

    //select threshold value to be 1 out of 2
    await this.selectOptionByValue(
      this.transactionPage.selectThresholdValueIndexSelector + '0-1',
      '1',
    );

    await this.transactionPage.clickOnDoneButtonForComplexKeyCreation();

    await this.transactionPage.clickOnSignAndSubmitButton();
    await this.transactionPage.clickSignTransactionButton();
    const transactionId = await this.getTransactionDetailsId();
    await this.clickOnSignTransactionButton();
    const transactionResponse =
      await this.transactionPage.mirrorGetTransactionResponse(transactionId);
    this.complexAccountId.push(transactionResponse.transactions[0].entity_id);
  }

  async clickOnSignTransactionButton() {
    await this.clickByTestId(this.signTransactionButtonSelector, 5000);
  }

  async getTransactionDetailsId() {
    return await this.getTextByTestId(this.transactionDetailsIdSelector, 5000);
  }

  async getValidStart() {
    return await this.getTextByTestId(this.transactionValidStartSelector);
  }

  getComplexAccountId() {
    return this.complexAccountId[0];
  }

  async clickOnReadyToSignTab() {
    await this.clickByTestId(this.readyToSignTabSelector);
  }

  async clickOnInProgressTab() {
    await this.clickByTestId(this.inProgressTabSelector);
  }

  async clickOnReadyForExecutionTab() {
    await this.clickByTestId(this.readyForExecutionTabSelector);
  }

  async clickOnHistoryTab() {
    await this.clickByTestId(this.historyTabSelector);
  }

  async updateAccount(accountId, memo, timeForExecution = 10, isSignRequiredFromCreator = false) {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await this.transactionPage.clickOnUpdateAccountTransaction();
    await this.setDateTimeAheadBy(timeForExecution);
    await this.transactionPage.fillInUpdatedAccountId(accountId);
    await this.transactionPage.fillInMemoUpdate(memo);
    await this.transactionPage.fillInTransactionMemoUpdate('tx memo update');
    await this.transactionPage.waitForElementPresentInDOM(
      this.transactionPage.updateAccountIdFetchedDivSelector,
      30000,
    );
    await this.transactionPage.clickOnSignAndSubmitUpdateButton();
    await this.transactionPage.clickSignTransactionButton();
    const txId = await this.getTransactionDetailsId();
    const validStart = await this.getValidStart();
    if (isSignRequiredFromCreator) {
      await this.clickOnSignTransactionButton();
    }
    return { txId, validStart };
  }

  async getReadyForSignTransactionIdByIndex(index) {
    return await this.getTextByTestId(this.readyForSignTransactionIdIndexSelector + index);
  }

  async getReadyForSignTransactionTypeByIndex(index) {
    return await this.getTextByTestId(this.readyForSignTransactionTypeIndexSelector + index);
  }

  async getReadyForSignValidStartByIndex(index) {
    return await this.getTextByTestId(this.readyForSignValidStartIndexSelector + index);
  }

  async isReadyForSignSubmitSignButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.readyForSignSubmitSignButtonIndexSelector + index);
  }

  async clickOnSubmitSignButtonByIndex(index) {
    await this.clickByTestId(this.readyForSignSubmitSignButtonIndexSelector + index, 5000);
  }

  async getInProgressTransactionIdByIndex(index) {
    return await this.getTextByTestId(this.inProgressTransactionIdIndexSelector + index);
  }

  async getInProgressTransactionTypeByIndex(index) {
    return await this.getTextByTestId(this.inProgressTransactionTypeIndexSelector + index);
  }

  async getInProgressValidStartByIndex(index) {
    return await this.getTextByTestId(this.inProgressValidStartIndexSelector + index);
  }

  async isInProgressDetailsButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.inProgressDetailsButtonIndexSelector + index);
  }

  async clickOnInProgressDetailsButtonByIndex(index) {
    await this.clickByTestId(this.inProgressDetailsButtonIndexSelector + index);
  }

  async getReadyForExecutionTransactionIdByIndex(index) {
    return await this.getTextByTestId(this.readyForExecutionTransactionIdIndexSelector + index);
  }

  async getReadyForExecutionTransactionTypeByIndex(index) {
    return await this.getTextByTestId(this.readyForExecutionTransactionTypeIndexSelector + index);
  }

  async getReadyForExecutionValidStartByIndex(index) {
    return await this.getTextByTestId(this.readyForExecutionValidStartIndexSelector + index);
  }

  async isReadyForExecutionDetailsButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.readyForExecutionDetailsButtonIndexSelector + index);
  }

  async clickOnReadyForExecutionDetailsButtonByIndex(index) {
    await this.clickByTestId(this.readyForExecutionDetailsButtonIndexSelector + index);
  }

  async getHistoryTransactionIdByIndex(index) {
    return await this.getTextByTestId(this.historyTransactionIdIndexSelector + index);
  }

  async getHistoryTransactionTypeByIndex(index) {
    return await this.getTextByTestId(this.historyTransactionTypeIndexSelector + index);
  }

  async getHistoryTransactionStatusByIndex(index) {
    return await this.getTextByTestId(this.historyTransactionStatusIndexSelector + index);
  }

  async getHistoryTransactionCreatedAtByIndex(index) {
    return await this.getTextByTestId(this.historyCreatedAtIndexSelector + index);
  }

  async isHistoryDetailsButtonVisibleByIndex(index) {
    return await this.isElementVisible(this.historyDetailsButtonIndexSelector + index);
  }

  async clickOnHistoryDetailsButtonByIndex(index) {
    await this.clickByTestId(this.historyDetailsButtonIndexSelector + index);
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
      const count = await this.countElementsByTestId(transactionIdIndexSelector);
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
      const count = await this.countElementsByTestId(this.readyForSignTransactionIdIndexSelector);
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
      const count = await this.countElementsByTestId(
        this.readyForExecutionTransactionIdIndexSelector,
      );
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
      const count = await this.countElementsByTestId(this.historyTransactionIdIndexSelector);
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
    const bubbleContent = await this.getInnerContentBySelector(
      this.stageBubbleIndexSelector + stageIndex,
    );
    return bubbleContent.trim().includes('bi-check-lg');
  }

  async isFirstSignerCheckmarkVisible() {
    return await this.isElementVisible(this.firstSignerCheckmarkSelector);
  }

  async isSecondSignerCheckmarkVisible() {
    return await this.isElementVisible(this.secondSignerCheckmarkSelector);
  }

  async isThirdSignerCheckmarkVisible() {
    return await this.isElementVisible(this.thirdSignerCheckmarkSelector);
  }
}

module.exports = OrganizationPage;
