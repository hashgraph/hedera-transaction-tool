const BasePage = require('./BasePage');

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
    await this.fillByTestId(selector, word);
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
        await this.clickByTestId(this.finalNextButtonSelector);
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
    if (firstSet.length !== secondSet.length) {
      throw new Error('The two word sets are not of the same length.');
    }
    return firstSet.every((word, index) => word !== secondSet[index]);
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

  async resetRegistrationForm() {
    await this.window.getByTestId(this.emailInputSelector).fill('');
    await this.window.getByTestId(this.passwordInputSelector).fill('');
    await this.window.getByTestId(this.confirmPasswordInputSelector).fill('');
  }

  async logoutForReset() {
    console.log('Checking if logout button is visible');
    const isLogoutButtonVisible = await this.isElementVisible(this.logoutButtonSelector);
    if (isLogoutButtonVisible) {
      console.log('Logout button is visible, clicking to logout');
      await this.clickByTestId(this.logoutButtonSelector);
      const element = this.window.getByTestId(this.emailInputSelector);
      await element.waitFor({ state: 'visible', timeout: 1000 });
    } else {
      console.log('Logout button not visible, assuming we are on the registration page');
      await this.resetRegistrationForm();
    }
  }

  // Combined method to verify all elements on Registration page
  async verifyRegistrationElements() {
    const checks = await Promise.all([
      this.isElementVisibleAndEditable(this.emailLabelSelector),
      this.isElementVisibleAndEditable(this.emailInputSelector),
      this.isElementVisibleAndEditable(this.passwordLabelSelector),
      this.isElementVisibleAndEditable(this.passwordInputSelector),
      this.isElementVisibleAndEditable(this.confirmPasswordLabelSelector),
      this.isElementVisibleAndEditable(this.confirmPasswordInputSelector),
      this.isElementVisibleAndEditable(this.registerButtonSelector),
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

  async typeEmail(email) {
    await this.fillByTestId(this.emailInputSelector, email);
  }

  async typePassword(password) {
    await this.fillByTestId(this.passwordInputSelector, password);
  }

  async typeConfirmPassword(confirmPassword) {
    await this.fillByTestId(this.confirmPasswordInputSelector, confirmPassword);
  }

  async submitRegistration() {
    await this.clickByTestId(this.registerButtonSelector);
  }

  async clickOnCreateNewTab() {
    await this.clickByTestId(this.createNewTabSelector);
  }

  async clickOnImportTab() {
    await this.clickByTestId(this.importExistingTabSelector);
  }

  async clickOnUnderstandCheckbox() {
    await this.clickByTestIdWithIndex(this.understandBackedUpCheckboxSelector);
  }

  async clickOnGenerateButton() {
    await this.clickByTestId(this.generateButtonSelector);
  }

  async clickOnVerifyButton() {
    await this.clickByTestId(this.verifyButtonSelector);
  }

  async clickOnClearButton() {
    await this.clickByTestId(this.clearButtonSelector);
  }

  async clickOnNextButton() {
    await this.clickByTestId(this.nextButtonSelector);
  }

  async clickOnNextImportButton() {
    await this.clickByTestId(this.nextButtonImportSelector);
  }

  async scrollToNextImportButton() {
    await this.scrollIntoViewByTestId(this.nextButtonImportSelector);
  }

  async getEmailErrorMessage() {
    return await this.getTextByTestId(this.emailErrorMessageSelector);
  }

  async isEmailErrorMessageVisible() {
    return await this.isElementVisible(this.emailErrorMessageSelector);
  }

  async getPasswordErrorMessage() {
    return await this.getTextByTestId(this.passwordErrorMessageSelector);
  }

  async getConfirmPasswordErrorMessage() {
    return await this.getTextByTestId(this.confirmPasswordErrorMessageSelector);
  }

  async isCreateNewTabVisible() {
    return await this.isElementVisibleAndEditable(this.createNewTabSelector);
  }

  async isUnderstandCheckboxVisible() {
    return await this.isElementVisibleByIndex(this.understandBackedUpCheckboxSelector);
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
    return await this.getTextByCssSelector(this.toastMessageSelector);
  }

  async clickOnGenerateAgainButton() {
    await this.clickByTestId(this.generateAgainButtonSelector);
  }
}

module.exports = RegistrationPage;
