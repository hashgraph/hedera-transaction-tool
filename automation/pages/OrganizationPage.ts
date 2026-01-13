import { BasePage } from './BasePage.js';
import { Page, expect } from '@playwright/test';
import { RegistrationPage } from './RegistrationPage.js';
import { SettingsPage } from './SettingsPage.js';
import { TransactionPage } from './TransactionPage.js';
import {
  compareJsonFiles,
  generateRandomEmail,
  generateRandomPassword,
  parsePropertiesContent,
  setupEnvironmentForTransactions,
  waitForValidStart,
} from '../utils/util.js';
import { createTestUsersBatch } from '../utils/databaseUtil.js';
import { Mnemonic } from '@hashgraph/sdk';
import {
  findNewKey,
  getAllTransactionIdsForUserObserver,
  getFirstPublicKeyByEmail,
  getLatestInAppNotificationStatusByEmail,
  getUserIdByEmail,
  insertKeyPair,
  insertUserKey,
  isKeyDeleted,
  verifyOrganizationExists,
} from '../utils/databaseQueries.js';
import * as fs from 'node:fs';
import { generateMnemonic } from '../utils/keyUtil.js';
import { argonHash, encrypt } from '../utils/crypto.js';
import {
  encodeExchangeRates,
  encodeFeeSchedule,
  encodeNodeAddressBook,
  encodeServicesConfigurationList,
  encodeThrottleDefinitions,
} from '../utils/encodeSystemFiles.js';
import {
  normalizeExchangeRateData,
  normalizeFeeScheduleData,
  normalizeThrottleData,
} from '../utils/dataNormalizer.js';

interface TransactionDetails {
  txId: string | null;
  validStart: string | null;
}

export interface UserDetails {
  email: string;
  password: string;
  privateKey: string;
}

export interface Credentials {
  email: string;
  password: string;
}

export class OrganizationPage extends BasePage {
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
  notificationsButtonSelector = 'button-notifications';
  editNicknameOrganizationButtonSelector = 'button-edit-nickname';
  logoutButtonSelector = 'button-logout';
  contactListButton = 'button-contact-list';
  deleteNextButtonSelector = 'button-delete-next';
  addObserverButtonSelector = 'button-add-observer';
  addUserButtonSelector = 'button-add-user';
  timePickerIconSelector = '.dp--tp-wrap button[aria-label="Open time picker"]';
  incrementSecondsButtonSelector = 'button[aria-label="Increment seconds"]';
  incrementMinutesButtonSelector = 'button[aria-label="Increment minutes"]';
  incrementHourButtonSelector = 'button[aria-label="Increment hours"]';
  secondsOverlayButtonSelector = 'button[data-test-id="seconds-toggle-overlay-btn-0"]';
  minutesOverlayButtonSelector = 'button[data-test-id="minutes-toggle-overlay-btn-0"]';
  hoursOverlayButtonSelector = 'button[data-test-id="hours-toggle-overlay-btn-0"]';
  signTransactionButtonSelector = 'button-sign-org-transaction';
  nextTransactionButtonSelector = 'button-next-org-transaction';
  cancelAddingOrganizationButtonSelector = 'button-cancel-adding-org';
  rejectAllTransactionsButtonSelector = 'button-reject-group';
  approveAllTransactionsButtonSelector = 'button-approve-group';
  signAllTransactionsButtonSelector = 'button-sign-group';
  cancelAllTransactionsButtonSelector = 'button-cancel-group';
  exportAllTransactionsButtonSelector = 'button-export-group';
  confirmGroupActionButtonSelector = 'button-confirm-group-action';
  cancelGroupActionButtonSelector = 'button-cancel-group-action';
  // Inputs
  organizationNicknameInputSelector = 'input-organization-nickname';
  serverUrlInputSelector = 'input-server-url';
  encryptPasswordInputSelector = 'input-encrypt-password';
  emailForOrganizationInputSelector = 'input-login-email-for-organization';
  passwordForOrganizationInputSelector = 'input-login-password-for-organization';
  editOrganizationNicknameInputSelector = 'input-edit-nickname';
  // Texts
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

  transactionNodeTransactionIdIndexSelector = 'td-transaction-node-transaction-id-';
  transactionNodeTransactionTypeIndexSelector = 'td-transaction-node-transaction-type-';
  transactionNodeValidStartIndexSelector = 'td-transaction-node-transaction-valid-start-';
  transactionNodeExecutedAtIndexSelector = 'td-transaction-node-transaction-executed-at-';
  transactionNodeStatusIndexSelector = 'td-transaction-node-transaction-status-';
  transactionNodeSignButtonIndexSelector = 'button-transaction-node-sign-';
  transactionNodeDetailsButtonIndexSelector = 'button-transaction-node-details-';

  stageBubbleIndexSelector = 'div-stepper-nav-item-bubble-';
  observerIndexSelector = 'span-group-email-';
  userListIndexSelector = 'span-email-';
  // Elements
  notificationsIndicatorElement = 'notification-indicator';

  users: UserDetails[];
  complexAccountId: string[];
  complexFileId: string[];
  organizationRecoveryWords: Array<Array<string>>;
  transactions: TransactionDetails[];

  private readonly registrationPage: RegistrationPage;
  private readonly settingsPage: SettingsPage;
  private readonly transactionPage: TransactionPage;

  constructor(window: Page) {
    super(window);
    this.users = []; // List to store user credentials
    this.transactions = []; // List to store transactions
    this.organizationRecoveryWords = []; // List to store recovery phrase words for organization
    this.complexAccountId = []; // List to store complex account ids
    this.complexFileId = []; // List to store complex file ids
    this.registrationPage = new RegistrationPage(window);
    this.settingsPage = new SettingsPage(window);
    this.transactionPage = new TransactionPage(window);
  }

  async clickOnAddNewOrganizationButton() {
    await this.click(this.addNewOrganizationButtonSelector);
  }

  async fillOrganizationDetailsAndContinue(organizationNickname: string, serverUrl: string) {
    await this.fill(this.organizationNicknameInputSelector, organizationNickname);
    await this.fill(this.serverUrlInputSelector, serverUrl);
    await this.click(this.addOrganizationButtonInModalSelector);
  }

  async fillOrganizationEncryptionPasswordAndContinue(password: string) {
    await this.fill(this.encryptPasswordInputSelector, password);
    await this.click(this.continueEncryptPasswordButtonSelector);
  }

  async signInOrganization(email: string, password: string, encryptionPassword: string) {
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

  async fillInLoginDetailsAndClickSignIn(email: string, password: string) {
    await this.fill(this.emailForOrganizationInputSelector, email);
    await this.fill(this.passwordForOrganizationInputSelector, password);
    await this.click(this.signInOrganizationButtonSelector);
  }

  async setupOrganization() {
    const organizationNickname = 'Test Organization';
    const serverUrl = process.env.ORGANIZATION_URL ?? '';
    await this.clickOnAddNewOrganizationButton();
    await this.fillOrganizationDetailsAndContinue(organizationNickname, serverUrl);
  }

  async setupWrongOrganization() {
    const organizationNickname = 'Bad Organization';
    const serverUrl = (process.env.ORGANIZATION_URL ?? '') + Math.floor(Math.random() * 10);
    await this.clickOnAddNewOrganizationButton();
    await this.fillOrganizationDetailsAndContinue(organizationNickname, serverUrl);
  }

  /**
   * Method to create users for the organization
   *
   * @param {number} numUsers - The number of users to create
   */

  async createUsers(numUsers: number = 1): Promise<void> {
    const usersData = [];

    for (let i = 0; i < numUsers; i++) {
      const email = generateRandomEmail();
      const password = generateRandomPassword();
      usersData.push({ email, password });
      this.users.push({ email, password, privateKey: '' });
    }

    // Pass the batch of user data to the database utility function
    await createTestUsersBatch(usersData);
  }

  async setUpInitialUsers(window: Page, encryptionPassword: string, setPrivateKey = true) {
    const user = this.users[0];
    const privateKey = process.env.PRIVATE_KEY ?? '';

    // Full setup for the first user (index 0) who is payer
    await this.signInOrganization(user.email, user.password, encryptionPassword);

    await this.waitForElementToBeVisible(this.registrationPage.createNewTabSelector);
    await this.registrationPage.clickOnCreateNewTab();
    await this.registrationPage.clickOnUnderstandCheckbox();
    await this.registrationPage.clickOnGenerateButton();

    await this.captureRecoveryPhraseWordsForUser(0);
    await this.registrationPage.clickOnUnderstandCheckbox();
    await this.registrationPage.clickOnVerifyButton();

    await this.fillAllMissingRecoveryPhraseWordsForUser(0);
    await this.registrationPage.clickOnNextButton();

    await this.registrationPage.waitForElementToDisappear(
      this.registrationPage.toastMessageSelector,
    );
    await this.registrationPage.clickOnFinalNextButtonWithRetry();

    if (setPrivateKey) {
      await setupEnvironmentForTransactions(window, privateKey);
      this.users[0].privateKey = privateKey;
    }

    await this.settingsPage.navigateToLogout();
    await this.click(this.logoutButtonSelector);
    await this.waitForElementToBeVisible(this.emailForOrganizationInputSelector);

    await this.setUpUsers(encryptionPassword, 1, this.users.length - 1);
  }

  async setUpUsers(encryptionPassword: string, startIndex: number, endIndex: number) {
    for (let i = startIndex; i <= endIndex; i++) {
      const user = this.users[i];
      this.users[i].privateKey = await this.generateAndStoreUserKey(user.email, encryptionPassword);
    }
  }

  async createAdditionalUsers(numNewUsers: number, encryptionPassword: string) {
    await this.createUsers(numNewUsers);
    await this.setUpUsers(
      encryptionPassword,
      this.users.length - numNewUsers,
      this.users.length - 1,
    );
  }

  async generateAndStoreUserKey(email: string, password: string) {
    // Generate a 24-word mnemonic phrase
    const mnemonic = await Mnemonic.generate();

    // Hash the mnemonic phrase
    const mnemonicHash = await argonHash(mnemonic.toString(), true);

    const privateKey = await mnemonic.toStandardEd25519PrivateKey('', 0);

    const privateKeyString = privateKey.toStringRaw();
    const publicKeyString = privateKey.publicKey.toStringRaw();

    // Encrypt the private key
    const encryptedPrivateKey = encrypt(privateKeyString, password);

    // Get the user ID by email
    const userId = await this.getUserIdByEmail(email);

    // Insert the mnemonic hash and public key into the user_key table
    await insertUserKey(userId, mnemonicHash, 0, publicKeyString);

    // Insert the public key and encrypted private key into the key_pair table
    await insertKeyPair(publicKeyString, encryptedPrivateKey, mnemonicHash, userId);

    return privateKeyString;
  }

  async recoverAccount(userIndex: number) {
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

  async recoverPrivateKey(window: Page) {
    // for settings tests we are recovering User#1 which has PRIVATE_KEY_2 in the database
    await setupEnvironmentForTransactions(window, process.env.PRIVATE_KEY);
  }

  getUser(index: number) {
    if (index < 0 || index >= this.users.length) {
      throw new Error('Invalid user index');
    }
    return this.users[index];
  }

  getUserPasswordByEmail(email: string) {
    const user = this.users.find(user => user.email === email);
    if (!user) {
      throw new Error(`User with email ${email} is not defined`);
    }
    return user.password;
  }

  changeUserPassword(email: string, newPassword: string) {
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

  async clickOnDeleteFirstOrganization() {
    await this.click(this.deleteOrganizationButtonSelector, 0);
  }

  async clickOnSelectModeDropdown() {
    await this.click(this.dropdownSelectModeSelector);
  }

  async isNotificationIndicatorElementVisible() {
    return this.isElementVisible(this.notificationsIndicatorElement);
  }

  async getNotificationElementFromFirstTransaction() {
    return await this.hasBeforePseudoElement(this.transactionNodeTransactionIdIndexSelector + '0');
  }

  /**
   * Finds a transaction row by its transaction ID and checks if it has the notification indicator.
   * This is more precise than checking index 0 when multiple transactions exist.
   * @param transactionId - The SDK transaction ID (e.g., "0.0.123@1234567890.000000000")
   * @returns true if the transaction row has the notification indicator, false otherwise
   */
  async hasNotificationForTransaction(transactionId: string): Promise<boolean> {
    const rows = await this.window.locator(`[data-testid^="${this.transactionNodeTransactionIdIndexSelector}"]`).all();

    for (let i = 0; i < rows.length; i++) {
      const rowText = await this.getText(this.transactionNodeTransactionIdIndexSelector + i);

      if (rowText && rowText.includes(transactionId)) {
        return await this.hasBeforePseudoElement(this.transactionNodeTransactionIdIndexSelector + i);
      }
    }

    return false;
  }

  async selectModeByIndex(index: number) {
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
    await this.settingsPage.navigateToLogout();
    await this.click(this.logoutButtonSelector);
  }

  async verifyOrganizationExists(nickname: string) {
    return await verifyOrganizationExists(nickname);
  }

  // Method to capture all the recovery phrase words and their indexes
  async captureRecoveryPhraseWordsForUser(userIndex: number) {
    this.organizationRecoveryWords[userIndex] = [];
    for (let i = 1; i <= 24; i++) {
      const selector = this.registrationPage.getRecoveryWordSelector(i);
      const wordElement = this.window.getByTestId(selector);
      this.organizationRecoveryWords[userIndex][i] = await wordElement.inputValue();
    }
  }

  // Method to fill a missing recovery phrase word by index
  async fillRecoveryPhraseWordForUser(userIndex: number, index: number, word: string) {
    const selector = this.registrationPage.getRecoveryWordSelector(index);
    await this.fill(selector, word);
  }

  // Method to fill in all missing recovery phrase words based on the saved recoveryPhraseWords
  async fillAllMissingRecoveryPhraseWordsForUser(userIndex: number) {
    for (let i = 1; i <= 24; i++) {
      const selector = this.registrationPage.getRecoveryWordSelector(i);
      const wordElement = this.window.getByTestId(selector);
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
    this.organizationRecoveryWords[0] = [];
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

  async isContactListButtonHidden() {
    return await this.isElementHidden(this.contactListButton);
  }

  async clickOnEditNicknameOrganizationButton() {
    await this.click(this.editNicknameOrganizationButtonSelector);
  }

  async fillInNewOrganizationNickname(nickname: string) {
    await this.fill(this.editOrganizationNicknameInputSelector, nickname);
  }

  async getOrganizationNicknameText() {
    return await this.getText(this.organizationNicknameTextSelector);
  }

  async editOrganizationNickname(newNickname: string) {
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

  async isFirstMissingKeyHidden() {
    return await this.isElementHidden(this.firstMissingKeyIndexSelector);
  }

  async clickOnDeleteNextButton() {
    await this.click(this.deleteNextButtonSelector);
  }

  async isDeleteNextButtonVisible() {
    return await this.isElementVisible(this.deleteNextButtonSelector);
  }

  async getFirstPublicKeyByEmail(email: string) {
    return await getFirstPublicKeyByEmail(email);
  }

  async getUserIdByEmail(email: string) {
    return await getUserIdByEmail(email);
  }

  async isKeyDeleted(publicKey: string) {
    return await isKeyDeleted(publicKey);
  }

  async findNewKey(userId: number) {
    return await findNewKey(userId);
  }

  async getAllTransactionIdsForUserObserver(userId: number) {
    return await getAllTransactionIdsForUserObserver(userId);
  }

  async clickOnAddObserverButton() {
    await this.click(this.addObserverButtonSelector);
  }

  async clickOnAddUserButtonForObserver() {
    await this.click(this.addUserButtonSelector);
  }

  async clickOnUserOfObserverList(index: number) {
    await this.click(this.userListIndexSelector + index);
  }

  async getUserOfObserverList(index: number) {
    return await this.getText(this.userListIndexSelector + index);
  }

  /**
   * Opens the date picker.
   */
  async openDatePicker() {
    await this.window.click(`[data-test-id="dp-input"]`);
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
  async moveTimeAheadBySeconds(seconds: number) {
    const increment = async (selector: string, count: number) => {
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
      (await this.window.textContent(this.secondsOverlayButtonSelector)) ?? '',
    );
    const currentMinutes = parseInt(
      (await this.window.textContent(this.minutesOverlayButtonSelector)) ?? '',
    );
    const currentHours = parseInt(
      (await this.window.textContent(this.hoursOverlayButtonSelector)) ?? '',
    );

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
    const transactionId = (await this.getTransactionDetailsId()) ?? '';
    await this.clickOnSignTransactionButton();
    const validStart = (await this.getValidStart()) ?? '';
    await waitForValidStart(validStart);
    const transactionResponse =
      await this.transactionPage.mirrorGetTransactionResponse(transactionId);
    this.complexAccountId.push(transactionResponse?.entity_id ?? '');

    // Navigate back to transactions list to ensure clean state for next call
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.waitForElementToBeVisible('button-create-new');
  }

  async createComplexKeyAccountForUsers(numberOfUsers = 9, groupSize = 3) {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await this.transactionPage.clickOnCreateAccountTransaction();
    await this.transactionPage.fillInInitialFunds('100');
    await this.transactionPage.clickOnComplexTab();
    await this.transactionPage.clickOnCreateNewComplexKeyButton();

    const groupCount = Math.ceil(numberOfUsers / groupSize);

    // Add group thresholds and public keys
    for (let groupIdx = 0; groupIdx < groupCount; groupIdx++) {
      const groupDepth = `0-${groupIdx}`;
      await this.transactionPage.addThresholdKeyAtDepth('0');
      // await this.transactionPage.addThresholdKeyAtDepth(groupDepth);

      // Add 3 public keys to this group threshold
      for (let j = 0; j < groupSize; j++) {
        const userIdx = groupIdx * groupSize + j;
        if (userIdx >= numberOfUsers) break;
        const publicKey = await this.getFirstPublicKeyByEmail(this.users[userIdx + 1].email);
        await this.transactionPage.addPublicKeyAtDepth(`${groupDepth}`, publicKey);
      }

      // Set group threshold to 1 of 3
      await this.selectOptionByValue(
        this.transactionPage.selectThresholdValueByIndex + groupDepth,
        '1',
      );
    }

    //This should be a parameter
    // Set base threshold to ceil(groupCount / 2) of groupCount
    await this.selectOptionByValue(
      this.transactionPage.selectThresholdValueByIndex + '0',
      Math.ceil(groupCount / 2).toString(),
    );

    await this.transactionPage.clickOnDoneButtonForComplexKeyCreation();
    await this.transactionPage.clickOnSignAndSubmitButton();
    await this.transactionPage.clickSignTransactionButton();
    const transactionId = (await this.getTransactionDetailsId()) ?? '';
    await this.clickOnSignTransactionButton();
    const validStart = (await this.getValidStart()) ?? '';
    await waitForValidStart(validStart);
    const transactionResponse =
      await this.transactionPage.mirrorGetTransactionResponse(transactionId);
    return transactionResponse?.entity_id;
  }

  async logInAndSignTransactionByAllUsers(encryptionPassword: string, txId: string) {
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
    const transactionId = (await this.getTransactionDetailsId()) ?? '';
    await this.clickOnSignTransactionButton();
    await new Promise(resolve => setTimeout(resolve, 6000));

    // Store the complex account ID
    const transactionResponse =
      await this.transactionPage.mirrorGetTransactionResponse(transactionId);
    this.complexAccountId.push(transactionResponse.entity_id ?? '');
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

  async createAccountWithFeePayerId(feePayerId: string) {
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await this.transactionPage.clickOnCreateAccountTransaction();
    await this.transactionPage.waitForPublicKeyToBeFilled();
    await this.transactionPage.fillInPayerAccountId(feePayerId);
    return await this.processTransaction();
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

  async startNewTransaction(transactionTypeFunction: () => Promise<void>) {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.transactionPage.clickOnCreateNewTransactionButton();
    await transactionTypeFunction();
  }

  async processTransaction(isSignRequiredFromCreator = false, isDeleteTransaction = false) {
    await this.transactionPage.clickOnSignAndSubmitButton();
    if (isDeleteTransaction) {
      await this.transactionPage.clickOnConfirmDeleteAccountButton();
    }
    await this.transactionPage.clickSignTransactionButton();

    const txId = await this.getTransactionDetailsId();
    const validStart = await this.getValidStart();

    if (isSignRequiredFromCreator) {
      await this.clickOnSignTransactionButton();
    }
    return { txId, validStart };
  }

  async updateAccount(
    accountId: string,
    memo: string,
    timeForExecution = 10,
    isSignRequiredFromCreator = false,
  ) {
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
    fromAccountId: string,
    amount: string,
    timeForExecution = 12,
    isSignRequiredFromCreator = true,
  ) {
    await this.startNewTransaction(() => this.transactionPage.clickOnTransferTokensTransaction());
    await this.setDateTimeAheadBy(timeForExecution);

    await this.fill(this.transactionPage.transferFromAccountIdInputSelector, fromAccountId);
    await this.transactionPage.fillInTransferAmountFromAccount(amount);

    const payerAccountId = await this.transactionPage.getPayerAccountId();
    await this.transactionPage.fillInTransferToAccountId(payerAccountId);

    await this.transactionPage.clickOnAddTransferFromButton();
    await this.transactionPage.fillInTransferAmountToAccount(amount);
    await this.transactionPage.clickOnAddTransferToButton();

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async approveAllowance(
    ownerAccountId: string,
    amount: string,
    timeForExecution = 15,
    isSignRequiredFromCreator = true,
  ) {
    await this.startNewTransaction(() => this.transactionPage.clickOnApproveAllowanceTransaction());
    await this.setDateTimeAheadBy(timeForExecution);
    await this.transactionPage.fillInMaxTransactionFee('5');

    await this.transactionPage.fillInAllowanceOwner(ownerAccountId);
    await this.transactionPage.fillInAllowanceAmount(amount);
    await this.transactionPage.fillInSpenderAccountId(
      await this.transactionPage.getPayerAccountId(),
    );

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async deleteAccount(
    complexAccountId: string,
    timeForExecution = 15,
    isSignRequiredFromCreator = true,
  ) {
    await this.startNewTransaction(() => this.transactionPage.clickOnDeleteAccountTransaction());
    await this.setDateTimeAheadBy(timeForExecution);
    await this.transactionPage.fillInTransferAccountIdNormally(
      await this.transactionPage.getPayerAccountId(),
    );
    await this.transactionPage.fillInDeletedAccountId(complexAccountId);
    this.complexAccountId = [];
    return await this.processTransaction(isSignRequiredFromCreator, true);
  }

  async fileUpdate(
    fileId: string,
    complexAccountId: string,
    content: string,
    timeForExecution = 15,
    isSignRequiredFromCreator = true,
  ) {
    await this.startNewTransaction(async () => {
      await this.transactionPage.clickOnFileServiceLink();
      await this.transactionPage.clickOnUpdateFileSublink();
    });
    await this.setDateTimeAheadBy(timeForExecution);

    await this.transactionPage.clickOnComplexTab();
    await this.transactionPage.clickOnCreateNewComplexKeyButton();
    await this.transactionPage.addAccountAtDepth('0', complexAccountId);
    await this.transactionPage.clickOnDoneButtonForComplexKeyCreation();

    await this.transactionPage.fillInFileIdForUpdate(fileId);
    await this.transactionPage.fillInFileContentForUpdate(content);

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async fileAppend(
    fileId: string,
    complexAccountId: string,
    content: string,
    timeForExecution = 15,
    isSignRequiredFromCreator = true,
  ) {
    await this.startNewTransaction(async () => {
      await this.transactionPage.clickOnFileServiceLink();
      await this.transactionPage.clickOnAppendFileSublink();
    });
    await this.transactionPage.fillInPayerAccountId(complexAccountId);
    await this.setDateTimeAheadBy(timeForExecution);

    await this.transactionPage.fillInFileIdForAppend(fileId);
    await this.transactionPage.fillInFileContentForAppend(content);

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async fileCreate(
    timeForExecution = 10,
    isSignRequiredFromCreator = false,
    complexAccountId: string,
  ) {
    await this.startNewTransaction(async () => {
      await this.transactionPage.clickOnFileServiceLink();
      await this.transactionPage.clickOnFileCreateTransaction();
    });
    await this.transactionPage.clickOnComplexTab();
    await this.transactionPage.clickOnCreateNewComplexKeyButton();

    await this.transactionPage.addAccountAtDepth('0', complexAccountId);

    await this.transactionPage.clickOnDoneButtonForComplexKeyCreation();
    await this.setDateTimeAheadBy(timeForExecution);

    return await this.processTransaction(isSignRequiredFromCreator);
  }

  async ensureComplexFileExists(
    complexAccountId: string,
    globalCredentials: Credentials,
    firstUser: UserDetails,
    timeForExecution = 10,
    isSignRequiredFromCreator = true,
  ) {
    let txId, validStart, fileId: string | null;
    if (this.complexFileId.length === 0) {
      console.log('Creating a new complex file');
      ({ txId, validStart } = await this.fileCreate(
        timeForExecution,
        isSignRequiredFromCreator,
        complexAccountId,
      ));
      await this.signTxByAllUsersAndRefresh(globalCredentials, firstUser, txId ?? '');
      await waitForValidStart(validStart ?? '');
      const txResponse = await this.transactionPage.mirrorGetTransactionResponse(txId ?? '');
      fileId = txResponse?.entity_id;
      this.complexFileId.push(fileId ?? '');
      return { txId, fileId };
    } else {
      fileId = this.complexFileId[0];
      return { fileId };
    }
  }

  async signTxByAllUsersAndRefresh(
    globalCredentials: Credentials,
    firstUser: UserDetails,
    txId: string,
  ) {
    await this.transactionPage.clickOnTransactionsMenuButton();
    await this.logoutFromOrganization();

    await this.logInAndSignTransactionByAllUsers(globalCredentials.password, txId);
    await this.signInOrganization(firstUser.email, firstUser.password, globalCredentials.password);

    await this.clickOnHistoryTab();
  }

  async updateSystemFile(fileId: string, timeForExecution = 10, isSignRequiredFromCreator = false) {
    await this.startNewTransaction(async () => {
      await this.transactionPage.clickOnFileServiceLink();
      await this.transactionPage.clickOnUpdateFileSublink();
    });
    await this.transactionPage.fillInPayerAccountId('0.0.2');
    await this.setDateTimeAheadBy(timeForExecution);
    await this.transactionPage.fillInFileIdForUpdate(fileId);

    const fileMappings: Record<
      string,
      {
        encodeFunction: (jsonFilePath: string, outputFilePath: string) => void;
        inputFile: string;
        outputFile: string;
        binFile: string;
        specialProcessing?: boolean;
      }
    > = {
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

    fileInfo.encodeFunction(fileInfo.inputFile, fileInfo.outputFile);
    await this.transactionPage.uploadSystemFile(fileInfo.binFile);

    let txId, validStart;

    if (fileInfo.specialProcessing) {
      // Special processing for large files
      // It does not go through the standard transaction processing
      // Instead it goes into a transaction group
      await this.transactionPage.clickOnSignAndSubmitButton();
      await this.transactionPage.clickSignTransactionButton();
      const txIdArray: string[] = (await this.getGroupTransactionIdText())?.split(',') ?? [];
      const validStartArray = (await this.getGroupValidStartText())?.split(',') ?? [];
      txId = txIdArray.length > 0 ? txIdArray[txIdArray.length - 1] : null; // Get the last item in the array
      validStart = validStartArray.length > 0 ? validStartArray[0] : null;
      await this.clickOnSignAllTransactionsButton();
      await this.clickOnConfirmGroupActionButton();
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
  async areFilesIdentical(fileId: string): Promise<boolean> {
    // Read the file content from the application
    const textFromField = await this.transactionPage.readFile(fileId);
    if (!textFromField || textFromField.trim() === '') {
      throw new Error(`No data returned from application for fileId ${fileId}`);
    }

    // Mapping of file IDs to data files and file types
    const fileMappings: Record<
      string,
      {
        path: string;
        type: string;
        keysToIgnore?: string[];
        normalizer?: (text: string) => string;
      }
    > = {
      '0.0.101': { path: 'data/101.json', type: 'json', keysToIgnore: [] },
      '0.0.102': { path: 'data/102.json', type: 'json', keysToIgnore: [] },
      '0.0.111': {
        path: 'data/feeSchedules.json',
        type: 'json',
        keysToIgnore: [],
        normalizer: normalizeFeeScheduleData,
      },
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
        throw new Error(
          `Failed to parse local JSON file ${fileInfo.path}` +
            (error instanceof Error ? `: ${error.message}` : ''),
        );
      }

      // Parse remote JSON data from application
      try {
        remoteData = JSON.parse(textFromField);
      } catch (error) {
        throw new Error(
          `Failed to parse remote JSON data for fileId ${fileId}` +
            (error instanceof Error ? `: ${error.message}` : ''),
        );
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

  async clickOnConfirmGroupActionButton() {
    await this.click(this.confirmGroupActionButtonSelector);
  }

  async getReadyForSignTransactionIdByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionIdIndexSelector + index);
  }

  async getReadyForSignTransactionTypeByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionTypeIndexSelector + index);
  }

  async getReadyForSignValidStartByIndex(index: number) {
    return await this.getText(this.transactionNodeValidStartIndexSelector + index);
  }

  async isReadyForSignSubmitSignButtonVisibleByIndex(index: number) {
    return await this.isElementVisible(this.transactionNodeSignButtonIndexSelector + index);
  }

  async clickOnSubmitSignButtonByIndex(index: number) {
    await this.click(this.transactionNodeSignButtonIndexSelector + index, null, 5000);
  }

  async isReadyToSignDetailsButtonVisibleByIndex(index: number) {
    return await this.isElementVisible(this.transactionNodeDetailsButtonIndexSelector + index);
  }

  async clickOnReadyToSignDetailsButtonByIndex(index: number) {
    await this.click(this.transactionNodeDetailsButtonIndexSelector + index);
  }

  async getInProgressTransactionIdByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionIdIndexSelector + index);
  }

  async getInProgressTransactionTypeByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionTypeIndexSelector + index);
  }

  async getInProgressValidStartByIndex(index: number) {
    return await this.getText(this.transactionNodeValidStartIndexSelector + index);
  }

  async isInProgressDetailsButtonVisibleByIndex(index: number) {
    return await this.isElementVisible(this.transactionNodeDetailsButtonIndexSelector + index);
  }

  async getReadyForExecutionTransactionIdByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionIdIndexSelector + index);
  }

  async getReadyForExecutionTransactionTypeByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionTypeIndexSelector + index);
  }

  async getReadyForExecutionValidStartByIndex(index: number) {
    return await this.getText(this.transactionNodeValidStartIndexSelector + index);
  }

  async isReadyForExecutionDetailsButtonVisibleByIndex(index: number) {
    return await this.isElementVisible(this.transactionNodeDetailsButtonIndexSelector + index);
  }

  async clickOnReadyForExecutionDetailsButtonByIndex(index: number) {
    await this.click(this.transactionNodeDetailsButtonIndexSelector + index);
  }

  async getHistoryTransactionIdByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionIdIndexSelector + index);
  }

  async getHistoryTransactionTypeByIndex(index: number) {
    return await this.getText(this.transactionNodeTransactionTypeIndexSelector + index);
  }

  async getHistoryTransactionStatusByIndex(index: number) {
    return await this.getText(this.transactionNodeStatusIndexSelector + index);
  }

  async getHistoryTransactionExecutedAtByIndex(index: number) {
    return await this.getText(this.transactionNodeExecutedAtIndexSelector + index);
  }

  async isHistoryDetailsButtonVisibleByIndex(index: number) {
    return await this.isElementVisible(this.transactionNodeDetailsButtonIndexSelector + index);
  }

  async clickOnHistoryDetailsButtonByIndex(index: number) {
    await this.click(this.transactionNodeDetailsButtonIndexSelector + index);
  }

  async getTransactionDetails(
    transactionId: string,
    transactionIdIndexSelector: string,
    getTransactionIdByIndex: (index: number) => Promise<string | null>,
    getTransactionTypeByIndex: (index: number) => Promise<string | null>,
    getValidStartByIndex: (index: number) => Promise<string | null>,
    getDetailsButtonVisibleByIndex: (index: number) => Promise<boolean>,
    additionalFields: Array<{
      name: string;
      getter: (index: number) => Promise<any>;
    }>,
    maxRetries = 10,
    retryDelay = 500,
  ):Promise<{
    transactionId: string | null;
    transactionType: string | null;
    validStart: string | null;
    detailsButton: boolean;
    [key: string]: any; // for additionalFields
  } | null> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(transactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        const id = await getTransactionIdByIndex.call(this, i);
        if (id === transactionId) {
          const transactionType = await getTransactionTypeByIndex.call(this, i);
          const validStart = await getValidStartByIndex.call(this, i);
          const detailsButton = await getDetailsButtonVisibleByIndex.call(this, i);

          const additionalData: Record<string, string | null> = {};
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

  async getReadyForSignTransactionDetails(transactionId: string) {
    return await this.getTransactionDetails(
      transactionId,
      this.transactionNodeTransactionIdIndexSelector,
      this.getReadyForSignTransactionIdByIndex,
      this.getReadyForSignTransactionTypeByIndex,
      this.getReadyForSignValidStartByIndex,
      this.isReadyForSignSubmitSignButtonVisibleByIndex,
      [{ name: 'isSignButtonVisible', getter: this.isReadyForSignSubmitSignButtonVisibleByIndex }],
    );
  }

  async getInProgressTransactionDetails(transactionId: string) {
    return await this.getTransactionDetails(
      transactionId,
      this.transactionNodeTransactionIdIndexSelector,
      this.getInProgressTransactionIdByIndex,
      this.getInProgressTransactionTypeByIndex,
      this.getInProgressValidStartByIndex,
      this.isInProgressDetailsButtonVisibleByIndex,
      [],
    );
  }

  async getReadyForExecutionTransactionDetails(transactionId: string) {
    return await this.getTransactionDetails(
      transactionId,
      this.transactionNodeTransactionIdIndexSelector,
      this.getReadyForExecutionTransactionIdByIndex,
      this.getReadyForExecutionTransactionTypeByIndex,
      this.getReadyForExecutionValidStartByIndex,
      this.isReadyForExecutionDetailsButtonVisibleByIndex,
      [],
    );
  }

  async getHistoryTransactionDetails(transactionId: string): Promise<{
    transactionId: string | null;
    transactionType: string | null;
    validStart: string | null;
    detailsButton: boolean;
    [key: string]: any; // for additionalFields
  } | null> {
    return await this.getTransactionDetails(
      transactionId,
      this.transactionNodeTransactionIdIndexSelector,
      this.getHistoryTransactionIdByIndex,
      this.getHistoryTransactionTypeByIndex,
      this.getHistoryTransactionExecutedAtByIndex,
      this.isHistoryDetailsButtonVisibleByIndex,
      [{ name: 'status', getter: this.getHistoryTransactionStatusByIndex }],
    );
  }

  async clickOnSubmitSignButtonByTransactionId(
    transactionId: string,
    maxRetries = 10,
    retryDelay = 1000,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(this.transactionNodeTransactionIdIndexSelector);
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
    transactionId: string,
    maxRetries = 10,
    retryDelay = 1000,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(this.transactionNodeTransactionIdIndexSelector);
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
    transactionId: string,
    maxRetries = 10,
    retryDelay = 1000,
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const count = await this.countElements(this.transactionNodeTransactionIdIndexSelector);
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

  async isTransactionIdVisibleInProgress(transactionId: string, attempts = 10) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const count = await this.countElements(this.transactionNodeTransactionIdIndexSelector);
      for (let i = 0; i < count; i++) {
        if ((await this.getInProgressTransactionIdByIndex(i)) === transactionId) {
          return true;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    return false;
  }

  async isTransactionIdVisibleReadyForExecution(transactionId: string, attempts = 10) {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const count = await this.countElements(this.transactionNodeTransactionIdIndexSelector);
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
    accountId: string,
    memo: string,
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
  async isTransactionStageCompleted(stageIndex: number): Promise<boolean> {
    const bubbleContent = await this.getInnerContent(this.stageBubbleIndexSelector + stageIndex);
    return bubbleContent.trim().includes('bi-check-lg');
  }

  async isSecondSignerCheckmarkVisible() {
    return await this.isElementVisible(this.secondSignerCheckmarkSelector);
  }

  async getObserverEmail(index: number) {
    return await this.getText(this.observerIndexSelector + index);
  }

  async isNotificationNumberHidden() {
    return await this.isElementHidden(this.spanNotificationNumberSelector);
  }

  async createNotificationForUser(
    firstUser: UserDetails,
    secondUser: UserDetails,
    globalCredentials: Credentials,
  ) {
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

  async ensureNotificationStateForUser(
    firstUser: UserDetails,
    secondUser: UserDetails,
    globalCredentials: Credentials,
  ) {
    const notificationStatus = await getLatestInAppNotificationStatusByEmail(secondUser.email);

    // If there's no notification or the latest is read, create a new one
    if (!notificationStatus || notificationStatus.isRead) {
      await this.createNotificationForUser(firstUser, secondUser, globalCredentials);

      // Poll until the indicator notification is created by the backend (async process)
      await expect.poll(
        async () => {
          const status = await getLatestInAppNotificationStatusByEmail(secondUser.email);
          return status !== null && !status.isRead;
        },
        { timeout: 10000, intervals: [500] },
      ).toBe(true);
    }
    // If notification exists and is unread, secondUser is already logged in from createNotificationForUser
    // with notifications fetched via the frontend fix to loggedInOrganization watcher
  }

  async clickOnNextTransactionButton() {
    await this.click(this.nextTransactionButtonSelector);
  }

  async isNextTransactionButtonVisible() {
    return await this.isElementVisible(this.nextTransactionButtonSelector);
  }

  async clickOnCancelAddingOrganizationButton() {
    await this.click(this.cancelAddingOrganizationButtonSelector);
  }
}
