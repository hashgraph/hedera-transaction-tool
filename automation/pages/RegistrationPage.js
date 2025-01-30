const BasePage = require('./BasePage');
const { expect } = require('playwright/test');
const {
  verifyUserExists,
  getPublicKeyByEmail,
  verifyPrivateKeyExistsByEmail,
  verifyPublicKeyExistsByEmail,
} = require('../utils/databaseQueries');

class RegistrationPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.recoveryPhraseWords = {};
  }

  /* Selectors */

  // Inputs
  emailInputSelector = 'input-email';
  passwordInputSelector = 'input-password';
  confirmPasswordInputSelector = 'input-password-confirm';
  inputRecoveryWordBase = 'input-recovery-word-';
  nicknameInputSelector = 'input-nickname';
  keyTypeInputSelector = 'input-key-type';
  understandBackedUpCheckboxSelector = 'checkbox-understand-backed-up';

  // Buttons
  registerButtonSelector = 'button-login';
  createNewTabSelector = 'tab-0';
  importExistingTabSelector = 'tab-1';
  generateButtonSelector = 'button-next-genereate';
  verifyButtonSelector = 'button-verfiy';
  nextButtonSelector = 'button-next-generate';
  nextButtonImportSelector = 'button-next-import';
  finalNextButtonSelector = 'button-next';
  settingsButtonSelector = 'a[href="/settings/general"].link-menu.mt-2.active';
  clearButtonSelector = 'button-clear';
  generateAgainButtonSelector = 'button-generate-again';
  showPrivateKeyButtonSelector = 'button-show-private-key';
  logoutButtonSelector = 'button-logout';

  // Labels
  emailLabelSelector = 'label-email';
  passwordLabelSelector = 'label-password';
  confirmPasswordLabelSelector = 'label-password-confirm';
  accountSetupHeaderSelector = 'title-account-setup';
  publicKeyLabelSelector = 'label-public-key';
  keyTypeLabelSelector = 'label-key-type';
  privateKeyLabelSelector = 'label-private-key';

  // Messages
  toastMessageSelector = '.v-toast__text';
  emailErrorMessageSelector = 'invalid-text-email';
  passwordErrorMessageSelector = 'invalid-text-password';
  confirmPasswordErrorMessageSelector = 'invalid-text-password-not-match';
  recoveryPhraseMessageSelector = 'stepper-title-0';
  keyPairsMessageSelector = 'stepper-title-1';
  setRecoveryPhraseMessageSelector = 'text-set-recovery-phrase';
  privateKeySpanSelector = 'span-shown-private-key';
  publicKeySpanSelector = 'p-show-public-key';

  getRecoveryWordSelector(index) {
    return this.inputRecoveryWordBase + index;
  }

  // Method to capture all the recovery phrase words and their indexes
  async captureRecoveryPhraseWords() {
    this.recoveryPhraseWords = {}; // Reset the recoveryPhraseWords object
    for (let i = 1; i <= 24; i++) {
      const selector = this.getRecoveryWordSelector(i);
      const wordElement = await this.window.getByTestId(selector);
      this.recoveryPhraseWords[i] = await wordElement.inputValue();
    }
  }

  // Method to fill a missing recovery phrase word by index
  async fillRecoveryPhraseWord(index, word) {
    const selector = this.getRecoveryWordSelector(index);
    await this.fill(selector, word);
  }

  // Method to fill in all missing recovery phrase words based on the saved recoveryPhraseWords
  async fillAllMissingRecoveryPhraseWords() {
    for (let i = 1; i <= 24; i++) {
      const selector = this.getRecoveryWordSelector(i);
      const wordElement = await this.window.getByTestId(selector);
      const value = await wordElement.inputValue();
      if (!value) {
        const word = this.recoveryPhraseWords[i];
        if (word) {
          await this.fillRecoveryPhraseWord(i, word);
        }
      }
    }
  }

  async clickOnFinalNextButtonWithRetry(retryCount = 5) {
    let attempts = 0;
    let isSuccessful = false;

    while (attempts < retryCount && !isSuccessful) {
      try {
        // Attempt to click the final next button
        await this.click(this.finalNextButtonSelector);
        await this.window.waitForSelector(this.settingsButtonSelector, {
          state: 'visible',
          timeout: 1000,
        });
        isSuccessful = true; // If the above waitForSelector doesn't throw, we assume success
      } catch (error) {
        console.log(
          `Attempt ${attempts + 1} to click ${this.finalNextButtonSelector} failed, retrying...`,
        );
        await this.window.waitForTimeout(1000); // Wait for 1 second before retrying
        attempts++;
      }
    }

    if (!isSuccessful) {
      throw new Error('Failed to navigate to the next page after maximum attempts');
    }
  }

  compareWordSets(firstSet, secondSet) {
    const firstPhrase = firstSet.join(' ');
    const secondPhrase = secondSet.join(' ');
    return firstPhrase !== secondPhrase;
  }

  getCopyOfRecoveryPhraseWords() {
    return { ...this.recoveryPhraseWords };
  }

  async verifyAllMnemonicTilesArePresent() {
    let allTilesArePresent = true;
    for (let i = 1; i <= 24; i++) {
      const tileSelector = this.getRecoveryWordSelector(i);
      try {
        const isVisible = await this.isElementVisible(tileSelector);
        const isEditable = await this.isElementEditable(tileSelector);
        // Check if the tile is visible and it's not editable
        if (!isVisible && isEditable) {
          allTilesArePresent = false;
          break;
        }
      } catch (error) {
        console.error(`Error verifying tile ${i}:`, error);
        allTilesArePresent = false;
        break;
      }
    }
    return allTilesArePresent;
  }

  async verifyAtLeastOneMnemonicFieldCleared() {
    for (let i = 1; i <= 24; i++) {
      const wordFieldSelector = this.getRecoveryWordSelector(i);
      const fieldValue = await this.window.getByTestId(wordFieldSelector).inputValue();
      if (fieldValue === '') {
        console.log(`Field ${i} is cleared.`);
        return true;
      }
    }
    return false;
  }

  async verifyAllMnemonicFieldsCleared() {
    let allFieldsCleared = true;
    for (let i = 1; i <= 24; i++) {
      const wordFieldSelector = this.getRecoveryWordSelector(i);
      const fieldValue = await this.window.getByTestId(wordFieldSelector).inputValue();
      if (fieldValue !== '') {
        allFieldsCleared = false;
        console.log(`Field ${i} was not cleared.`);
        break;
      }
    }
    return allFieldsCleared;
  }

  async resetForm() {
    await this.fill(this.emailInputSelector, '');
    await this.fill(this.passwordInputSelector, '');
  }

  async logoutForReset() {
    const isLogoutButtonVisible = await this.isElementVisible(this.logoutButtonSelector);
    if (isLogoutButtonVisible) {
      console.log('Logout button is visible, clicking to logout');
      await this.click(this.logoutButtonSelector);
      const element = this.window.getByTestId(this.emailInputSelector);
      await element.waitFor({ state: 'visible', timeout: 1000 });
    } else {
      console.log('Logout button not visible, resetting the form');
      const isSecondPasswordVisible = await this.isElementVisible(
        this.confirmPasswordInputSelector,
      );
      if (isSecondPasswordVisible) {
        await this.resetForm();
        await this.fill(this.confirmPasswordInputSelector, '');
      } else {
        await this.resetForm();
      }
    }
  }

  // Combined method to verify all elements on Registration page
  async verifyRegistrationElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.emailLabelSelector),
      this.isElementEditable(this.emailInputSelector),
      this.isElementVisible(this.passwordLabelSelector),
      this.isElementEditable(this.passwordInputSelector),
      this.isElementVisible(this.confirmPasswordLabelSelector),
      this.isElementEditable(this.confirmPasswordInputSelector),
      this.isElementVisible(this.registerButtonSelector),
    ]);

    // Return true if all checks pass
    return checks.every(isTrue => isTrue);
  }

  async verifyAccountSetupElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.createNewTabSelector),
      this.isElementVisible(this.importExistingTabSelector),
      this.isElementVisible(this.accountSetupHeaderSelector),
      this.isElementVisible(this.setRecoveryPhraseMessageSelector),
      this.isElementVisible(this.recoveryPhraseMessageSelector),
      this.isElementVisible(this.keyPairsMessageSelector),
      this.isElementVisible(this.clearButtonSelector),
    ]);

    // Return true if all checks pass
    return checks.every(isTrue => isTrue);
  }

  async verifyFinalStepAccountSetupElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.nicknameInputSelector),
      this.isElementVisible(this.keyTypeLabelSelector),
      this.isElementVisible(this.keyTypeInputSelector),
      this.isElementVisible(this.privateKeyLabelSelector),
      this.isElementVisible(this.privateKeySpanSelector),
      this.isElementVisible(this.showPrivateKeyButtonSelector),
      this.isElementVisible(this.publicKeyLabelSelector),
      this.isElementVisible(this.publicKeySpanSelector),
    ]);

    // Return true if all checks pass
    return checks.every(isTrue => isTrue);
  }

  // Combined method to register
  async register(email, password, confirmPassword) {
    await this.typeEmail(email);
    await this.typePassword(password);
    await this.typeConfirmPassword(confirmPassword);
    await this.submitRegistration();
  }

  async completeRegistration(email, password) {
    await this.register(email, password, password);

    await this.clickOnCreateNewTab();
    await this.clickOnUnderstandCheckbox();
    await this.clickOnGenerateButton();

    await this.captureRecoveryPhraseWords();
    await this.clickOnUnderstandCheckbox();
    await this.clickOnVerifyButton();

    await this.fillAllMissingRecoveryPhraseWords();
    await this.clickOnNextButton();

    await this.waitForElementToDisappear(this.toastMessageSelector);
    await this.clickOnFinalNextButtonWithRetry();

    const toastMessage = await this.getToastMessage();
    expect(toastMessage).toBe('Key Pair saved successfully');
  }

  async verifyUserExists(email) {
    return await verifyUserExists(email);
  }

  async verifyPublicKeyExistsByEmail(email) {
    return await verifyPublicKeyExistsByEmail(email);
  }

  async verifyPrivateKeyExistsByEmail(email) {
    return await verifyPrivateKeyExistsByEmail(email);
  }

  async getPublicKeyByEmail(email) {
    return await getPublicKeyByEmail(email);
  }

  async typeEmail(email) {
    await this.fill(this.emailInputSelector, email);
  }

  async typePassword(password) {
    await this.fill(this.passwordInputSelector, password);
  }

  async typeConfirmPassword(confirmPassword) {
    await this.fill(this.confirmPasswordInputSelector, confirmPassword);
  }

  async submitRegistration() {
    await this.click(this.registerButtonSelector);
  }

  async clickOnCreateNewTab() {
    await this.click(this.createNewTabSelector);
  }

  async clickOnImportTab() {
    await this.click(this.importExistingTabSelector);
  }

  async clickOnUnderstandCheckbox() {
    await this.click(this.understandBackedUpCheckboxSelector);
  }

  async clickOnGenerateButton() {
    await this.click(this.generateButtonSelector);
  }

  async clickOnVerifyButton() {
    await this.click(this.verifyButtonSelector);
  }

  async clickOnClearButton() {
    const maxRetries = 10;
    let retries = 0;

    while (retries < maxRetries) {
      await this.click(this.clearButtonSelector);

      const atLeastOneFieldCleared = await this.verifyAtLeastOneMnemonicFieldCleared();

      if (atLeastOneFieldCleared) {
        break;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      retries++;
    }

    if (retries === maxRetries) {
      throw new Error('Failed to clear at least one mnemonic field after maximum retries');
    }
  }

  async clickOnNextButton() {
    await this.click(this.nextButtonSelector);
  }

  async clickOnNextImportButton() {
    await this.click(this.nextButtonImportSelector);
  }

  async scrollToNextImportButton() {
    await this.scrollIntoView(this.nextButtonImportSelector);
  }

  async getEmailErrorMessage() {
    return await this.getText(this.emailErrorMessageSelector);
  }

  async isEmailErrorMessageVisible() {
    return await this.isElementVisible(this.emailErrorMessageSelector);
  }

  async getPasswordErrorMessage() {
    return await this.getText(this.passwordErrorMessageSelector);
  }

  async getConfirmPasswordErrorMessage() {
    return await this.getText(this.confirmPasswordErrorMessageSelector);
  }

  async isCreateNewTabVisible() {
    return await this.isElementVisible(this.createNewTabSelector);
  }

  async isUnderstandCheckboxVisible() {
    return await this.isElementVisible(this.understandBackedUpCheckboxSelector);
  }

  async isGenerateButtonVisible() {
    return await this.isElementVisible(this.generateButtonSelector);
  }

  async isGenerateButtonDisabled() {
    return await this.isDisabled(this.generateButtonSelector);
  }

  async isClearButtonVisible() {
    return await this.isElementVisible(this.clearButtonSelector);
  }

  async getToastMessage() {
    return await this.getText(this.toastMessageSelector, null, 25000);
  }

  async clickOnGenerateAgainButton() {
    await this.click(this.generateAgainButtonSelector);
  }

  async isConfirmPasswordFieldVisible() {
    return await this.isElementVisible(this.confirmPasswordInputSelector, null, 5000);
  }

  async getPublicKey() {
    return await this.getText(this.publicKeySpanSelector);
  }

  async getPrivateKey() {
    return await this.getText(this.privateKeySpanSelector);
  }
}

module.exports = RegistrationPage;
