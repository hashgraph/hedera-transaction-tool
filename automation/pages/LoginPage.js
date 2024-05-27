const BasePage = require('./BasePage');

class LoginPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
  }

  /* Selectors */

  // Inputs
  emailInputSelector = 'input-email';
  passwordInputSelector = 'input-password';

  // Buttons
  signInButtonSelector = 'button-login';
  importantNoteModalButtonSelector = 'button-understand-agree';
  resetStateButtonSelector = 'link-reset';
  confirmResetStateButtonSelector = 'button-reset';
  keepLoggedInCheckboxSelector = 'checkbox-remember';
  logoutButtonSelector = 'button-logout';
  settingsButtonSelector = 'button-menu-settings';

  // Labels
  emailLabelSelector = 'label-email';
  passwordLabelSelector = 'label-password';

  // Messages
  toastMessageSelector = '.v-toast__text';
  invalidPasswordMessageSelector = 'invalid-text-password';
  invalidEmailMessageSelector = 'invalid-text-email';

  // Method to close the 'Important note' modal if it appears
  async closeImportantNoteModal() {
    // Wait for the button to be visible with a timeout
    const modalButton = this.window.getByTestId(this.importantNoteModalButtonSelector);
    await modalButton.waitFor({ state: 'visible', timeout: 500 }).catch(e => {});

    // If the modal is visible, then click the button to close the modal
    if (await modalButton.isVisible()) {
      await modalButton.click();
    }
  }

  async resetForm() {
    await this.fillByTestId(this.emailInputSelector, '');
    await this.fillByTestId(this.passwordInputSelector, '');
  }

  // specific logout method for the login tests
  async logout() {
    const isLogoutButtonVisible = await this.isElementVisible(this.logoutButtonSelector);
    if (isLogoutButtonVisible) {
      console.log('Logout button is visible, clicking to logout');
      await this.clickByTestId(this.logoutButtonSelector);
      const element = this.window.getByTestId(this.emailInputSelector);
      await element.waitFor({ state: 'visible', timeout: 1000 });
    } else {
      console.log('Logout button is not visible, resetting the form');
      await this.resetForm();
    }
  }

  async verifyLoginElements() {
    const checks = await Promise.all([
      this.isElementVisible(this.emailLabelSelector),
      this.isElementVisible(this.emailInputSelector),
      this.isElementVisible(this.passwordLabelSelector),
      this.isElementVisible(this.passwordInputSelector),
      this.isElementVisible(this.signInButtonSelector),
      this.isElementVisible(this.resetStateButtonSelector),
      this.isElementVisible(this.keepLoggedInCheckboxSelector),
    ]);
    return checks.every(isTrue => isTrue);
  }

  async login(email, password) {
    await this.typeEmail(email);
    await this.typePassword(password);
    await this.clickSignIn();
  }

  // Method to reset the application state
  async resetState() {
    // Check if the initial reset button exists and is visible
    const initialResetButtonExists = await this.isElementVisible(this.resetStateButtonSelector);

    // Proceed only if the initial reset button is visible
    if (initialResetButtonExists) {
      try {
        await this.clickByTestId(this.resetStateButtonSelector);
      } catch (e) {
        console.log('Failed to click on the reset link');
      }
      // Now wait for the confirmation reset button to become visible
      try {
        const resetButton = this.window.getByTestId(this.confirmResetStateButtonSelector);
        await resetButton.waitFor({ state: 'visible', timeout: 1000 });
        // If the waitFor resolves successfully, click the reset button
        await resetButton.click();
        await this.waitForToastToDisappear();
      } catch (e) {
        console.log("The 'Reset' modal did not appear within the timeout.");
      }
    }
  }

  async typeEmail(email) {
    await this.window.getByTestId(this.emailInputSelector).fill(email);
  }

  async typePassword(password) {
    await this.window.getByTestId(this.passwordInputSelector).fill(password);
  }

  async clickSignIn() {
    await this.window.getByTestId(this.signInButtonSelector).click();
  }

  async waitForToastToDisappear() {
    await this.waitForElementToDisappear(this.toastMessageSelector);
  }

  async isSettingsButtonVisible() {
    return await this.isElementVisible(this.settingsButtonSelector);
  }

  async getLoginPasswordErrorMessage() {
    return await this.getTextByTestId(this.invalidPasswordMessageSelector);
  }

  async getLoginEmailErrorMessage() {
    return await this.getTextByTestId(this.invalidEmailMessageSelector);
  }
}

module.exports = LoginPage;
