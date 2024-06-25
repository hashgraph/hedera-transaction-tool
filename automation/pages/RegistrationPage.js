const BasePage = require('./BasePage');
const { expect } = require('playwright/test');
const { queryDatabase } = require('../utils/databaseUtil');
import { allure } from 'allure-playwright';

class RegistrationPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.recoveryPhraseWords = {};
  }

  /* Selectors */
  emailInputSelector = 'input-email';
  passwordInputSelector = 'input-password';
  confirmPasswordInputSelector = 'input-password-confirm';
  inputRecoveryWordBase = 'input-recovery-word-';
  nicknameInputSelector = 'input-nickname';
  keyTypeInputSelector = 'input-key-type';
  understandBackedUpCheckboxSelector = 'checkbox-understand-backed-up';

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

  emailLabelSelector = 'label-email';
  passwordLabelSelector = 'label-password';
  confirmPasswordLabelSelector = 'label-password-confirm';
  accountSetupHeaderSelector = 'title-account-setup';
  publicKeyLabelSelector = 'label-public-key';
  keyTypeLabelSelector = 'label-key-type';
  privateKeyLabelSelector = 'label-private-key';

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

  async captureRecoveryPhraseWords() {
    await allure.step('Capture Recovery Phrase Words', async () => {
      this.recoveryPhraseWords = {};
      for (let i = 1; i <= 24; i++) {
        const selector = this.getRecoveryWordSelector(i);
        const wordElement = await this.window.getByTestId(selector);
        this.recoveryPhraseWords[i] = await wordElement.inputValue();
      }
    });
  }

  async fillRecoveryPhraseWord(index, word) {
    await allure.step(`Fill Recovery Phrase Word at Index ${index}`, async () => {
      const selector = this.getRecoveryWordSelector(index);
      await this.fillByTestId(selector, word);
    });
  }

  async fillAllMissingRecoveryPhraseWords() {
    await allure.step('Fill All Missing Recovery Phrase Words', async () => {
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
    });
  }

  async clickOnFinalNextButtonWithRetry(retryCount = 5) {
    await allure.step('Click on Final Next Button With Retry', async () => {
      let attempts = 0;
      let isSuccessful = false;
      while (attempts < retryCount && !isSuccessful) {
        try {
          await this.clickByTestId(this.finalNextButtonSelector);
          await this.window.waitForSelector(this.settingsButtonSelector, {
            state: 'visible',
            timeout: 1000,
          });
          isSuccessful = true;
        } catch (error) {
          console.log(
            `Attempt ${attempts + 1} to click ${this.finalNextButtonSelector} failed, retrying...`,
          );
          await this.window.waitForTimeout(1000);
          attempts++;
        }
      }
      if (!isSuccessful) {
        throw new Error('Failed to navigate to the next page after maximum attempts');
      }
    });
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
    return await allure.step('Verify All Mnemonic Tiles Are Present', async () => {
      let allTilesArePresent = true;
      for (let i = 1; i <= 24; i++) {
        const tileSelector = this.getRecoveryWordSelector(i);
        try {
          const isVisible = await this.isElementVisible(tileSelector);
          const isEditable = await this.isElementEditable(tileSelector);
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
    });
  }

  async verifyAllMnemonicFieldsCleared() {
    return await allure.step('Verify All Mnemonic Fields Cleared', async () => {
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
    });
  }

  async resetForm() {
    await allure.step('Reset Form', async () => {
      await this.fillByTestId(this.emailInputSelector, '');
      await this.fillByTestId(this.passwordInputSelector, '');
    });
  }

  async logoutForReset() {
    await allure.step('Logout For Reset', async () => {
      const isLogoutButtonVisible = await this.isElementVisible(this.logoutButtonSelector);
      if (isLogoutButtonVisible) {
        console.log('Logout button is visible, clicking to logout');
        await this.clickByTestId(this.logoutButtonSelector);
        const element = this.window.getByTestId(this.emailInputSelector);
        await element.waitFor({ state: 'visible', timeout: 1000 });
      } else {
        console.log('Logout button not visible, resetting the form');
        const isSecondPasswordVisible = await this.isElementVisible(
          this.confirmPasswordInputSelector,
        );
        if (isSecondPasswordVisible) {
          await this.resetForm();
          await this.fillByTestId(this.confirmPasswordInputSelector, '');
        } else {
          await this.resetForm();
        }
      }
    });
  }

  async verifyRegistrationElements() {
    return await allure.step('Verify Registration Elements', async () => {
      const checks = await Promise.all([
        this.isElementVisibleAndEditable(this.emailLabelSelector),
        this.isElementVisibleAndEditable(this.emailInputSelector),
        this.isElementVisibleAndEditable(this.passwordLabelSelector),
        this.isElementVisibleAndEditable(this.passwordInputSelector),
        this.isElementVisibleAndEditable(this.confirmPasswordLabelSelector),
        this.isElementVisibleAndEditable(this.confirmPasswordInputSelector),
        this.isElementVisibleAndEditable(this.registerButtonSelector),
      ]);
      return checks.every(isTrue => isTrue);
    });
  }

  async verifyAccountSetupElements() {
    return await allure.step('Verify Account Setup Elements', async () => {
      const checks = await Promise.all([
        this.isElementVisible(this.createNewTabSelector),
        this.isElementVisible(this.importExistingTabSelector),
        this.isElementVisible(this.accountSetupHeaderSelector),
        this.isElementVisible(this.setRecoveryPhraseMessageSelector),
        this.isElementVisible(this.recoveryPhraseMessageSelector),
        this.isElementVisible(this.keyPairsMessageSelector),
        this.isElementVisible(this.clearButtonSelector),
      ]);
      return checks.every(isTrue => isTrue);
    });
  }

  async verifyFinalStepAccountSetupElements() {
    return await allure.step('Verify Final Step Account Setup Elements', async () => {
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
      return checks.every(isTrue => isTrue);
    });
  }

  async register(email, password, confirmPassword) {
    await allure.step('Register', async () => {
      await this.typeEmail(email);
      await this.typePassword(password);
      await this.typeConfirmPassword(confirmPassword);
      await this.submitRegistration();
    });
  }

  async completeRegistration(email, password) {
    await allure.step('Complete Registration', async () => {
      await this.register(email, password, password);
      const isTabVisible = await this.isCreateNewTabVisible();
      expect(isTabVisible).toBe(true);
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
    });
  }

  async verifyUserExists(email) {
    return await allure.step('Verify User Exists', async () => {
      const query = `
        SELECT *
        FROM User
        WHERE email = ?`;
      const user = await queryDatabase(query, [email]);
      return user !== undefined;
    });
  }

  async getPublicKeyByEmail(email) {
    return await allure.step('Get Public Key By Email', async () => {
      const query = `
        SELECT kp.public_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?`;
      try {
        const row = await queryDatabase(query, [email]);
        return row ? row.public_key : null;
      } catch (error) {
        console.error('Error fetching public key:', error);
        return null;
      }
    });
  }

  async verifyPrivateKeyExistsByEmail(email) {
    return await allure.step('Verify Private Key Exists By Email', async () => {
      const query = `
        SELECT kp.private_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?
          AND kp.private_key IS NOT NULL`;
      try {
        const row = await queryDatabase(query, [email]);
        return row !== undefined;
      } catch (error) {
        console.error('Error checking for private key:', error);
        return false;
      }
    });
  }

  async verifyPublicKeyExistsByEmail(email) {
    return await allure.step('Verify Public Key Exists By Email', async () => {
      const query = `
        SELECT kp.public_key
        FROM KeyPair kp
                 JOIN User u ON u.id = kp.user_id
        WHERE u.email = ?
          AND kp.private_key IS NOT NULL`;
      try {
        const row = await queryDatabase(query, [email]);
        return row !== undefined;
      } catch (error) {
        console.error('Error checking for private key:', error);
        return false;
      }
    });
  }

  async typeEmail(email) {
    await allure.step('Type Email', async () => {
      await this.fillByTestId(this.emailInputSelector, email);
    });
  }

  async typePassword(password) {
    await allure.step('Type Password', async () => {
      await this.fillByTestId(this.passwordInputSelector, password);
    });
  }

  async typeConfirmPassword(confirmPassword) {
    await allure.step('Type Confirm Password', async () => {
      await this.fillByTestId(this.confirmPasswordInputSelector, confirmPassword);
    });
  }

  async submitRegistration() {
    await allure.step('Submit Registration', async () => {
      await this.clickByTestId(this.registerButtonSelector);
    });
  }

  async clickOnCreateNewTab() {
    await allure.step('Click on Create New Tab', async () => {
      await this.clickByTestId(this.createNewTabSelector);
    });
  }

  async clickOnImportTab() {
    await allure.step('Click on Import Tab', async () => {
      await this.clickByTestId(this.importExistingTabSelector);
    });
  }

  async clickOnUnderstandCheckbox() {
    await allure.step('Click on Understand Checkbox', async () => {
      await this.clickByTestId(this.understandBackedUpCheckboxSelector);
    });
  }

  async clickOnGenerateButton() {
    await allure.step('Click on Generate Button', async () => {
      await this.clickByTestId(this.generateButtonSelector);
    });
  }

  async clickOnVerifyButton() {
    await allure.step('Click on Verify Button', async () => {
      await this.clickByTestId(this.verifyButtonSelector);
    });
  }

  async clickOnClearButton() {
    await allure.step('Click on Clear Button', async () => {
      await this.clickByTestId(this.clearButtonSelector);
    });
  }

  async clickOnNextButton() {
    await allure.step('Click on Next Button', async () => {
      await this.clickByTestId(this.nextButtonSelector);
    });
  }

  async clickOnNextImportButton() {
    await allure.step('Click on Next Import Button', async () => {
      await this.clickByTestId(this.nextButtonImportSelector);
    });
  }

  async scrollToNextImportButton() {
    await allure.step('Scroll to Next Import Button', async () => {
      await this.scrollIntoViewByTestId(this.nextButtonImportSelector);
    });
  }

  async getEmailErrorMessage() {
    return await allure.step('Get Email Error Message', async () => {
      return await this.getTextByTestId(this.emailErrorMessageSelector);
    });
  }

  async isEmailErrorMessageVisible() {
    return await allure.step('Is Email Error Message Visible', async () => {
      return await this.isElementVisible(this.emailErrorMessageSelector);
    });
  }

  async getPasswordErrorMessage() {
    return await allure.step('Get Password Error Message', async () => {
      return await this.getTextByTestId(this.passwordErrorMessageSelector);
    });
  }

  async getConfirmPasswordErrorMessage() {
    return await allure.step('Get Confirm Password Error Message', async () => {
      return await this.getTextByTestId(this.confirmPasswordErrorMessageSelector);
    });
  }

  async isCreateNewTabVisible() {
    return await allure.step('Is Create New Tab Visible', async () => {
      return await this.isElementVisibleAndEditable(this.createNewTabSelector);
    });
  }

  async isUnderstandCheckboxVisible() {
    return await allure.step('Is Understand Checkbox Visible', async () => {
      return await this.isElementVisible(this.understandBackedUpCheckboxSelector);
    });
  }

  async isGenerateButtonVisible() {
    return await allure.step('Is Generate Button Visible', async () => {
      return await this.isElementVisible(this.generateButtonSelector);
    });
  }

  async isGenerateButtonDisabled() {
    return await allure.step('Is Generate Button Disabled', async () => {
      return await this.isDisabled(this.generateButtonSelector);
    });
  }

  async isClearButtonVisible() {
    return await allure.step('Is Clear Button Visible', async () => {
      return await this.isElementVisible(this.clearButtonSelector);
    });
  }

  async getToastMessage() {
    return await allure.step('Get Toast Message', async () => {
      return await this.getTextByCssSelector(this.toastMessageSelector, 25000);
    });
  }

  async clickOnGenerateAgainButton() {
    await allure.step('Click on Generate Again Button', async () => {
      await this.clickByTestId(this.generateAgainButtonSelector);
    });
  }

  async isConfirmPasswordFieldVisible() {
    return await allure.step('Is Confirm Password Field Visible', async () => {
      return await this.isElementVisible(this.confirmPasswordInputSelector, 5000);
    });
  }

  async getPublicKey() {
    return await allure.step('Get Public Key', async () => {
      return await this.getTextByTestId(this.publicKeySpanSelector);
    });
  }

  async getPrivateKey() {
    return await allure.step('Get Private Key', async () => {
      return await this.getTextByTestId(this.privateKeySpanSelector);
    });
  }
}

module.exports = RegistrationPage;
