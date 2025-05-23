const BasePage = require('./BasePage');

const SettingsPage = require('./SettingsPage');

class LoginPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
    this.settingsPage = new SettingsPage(window);
  }

  /* Selectors */

  // Inputs
  emailInputSelector = 'input-email';
  passwordInputSelector = 'input-password';

  // Buttons
  signInButtonSelector = 'button-login';
  importantNoteModalButtonSelector = 'button-understand-agree';
  rejectKeyChainButtonSelector = 'button-refuse-key-chain-mode';
  rejectMigrationButtonSelector = 'button-refuse-migration';
  resetStateButtonSelector = 'link-reset';
  confirmResetStateButtonSelector = 'button-reset';
  keepLoggedInCheckboxSelector = 'checkbox-remember';
  logoutButtonSelector = 'button-logout';
  settingsButtonSelector = 'button-menu-settings';
  profileTabButtonSelector = 'tab-4';

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

  // Method to close the 'Key Chain' modal if it appears
  async closeKeyChainModal() {
    // Wait for the button to be visible with a timeout
    //await this.waitForElementToBeVisible(this.rejectKeyChainButtonSelector, 500);

    // If the modal is visible, then click the button to close the modal
    if (await this.isElementVisible(this.rejectKeyChainButtonSelector)) {
      await this.click(this.rejectKeyChainButtonSelector);
    }
  }

  // Method to close the 'Begin Migration' modal if it appears
  async closeMigrationModal() {
    // Wait for the button to be visible with a timeout
    //await this.waitForElementToBeVisible(this.rejectMigrationButtonSelector, 500);

    // If the modal is visible, then click the button to close the modal
    if (await this.isElementVisible(this.rejectMigrationButtonSelector)) {
      await this.click(this.rejectMigrationButtonSelector);
    }
  }

  async resetForm() {
    await this.fill(this.emailInputSelector, '');
    await this.fill(this.passwordInputSelector, '');
  }

  // specific logout method for the login tests
  async logout() {
    await this.settingsPage.navigateToLogout(this.resetForm.bind(this));
    const isLogoutButtonVisible = await this.isElementVisible(this.logoutButtonSelector);
    if (isLogoutButtonVisible) {
      console.log('Logout button is visible, clicking to logout');
      await this.click(this.logoutButtonSelector);
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
        await this.click(this.resetStateButtonSelector);
      } catch (e) {
        console.log('Failed to click on the reset link');
      }
      // Now wait for the confirmation reset button to become visible
      try {
        const resetButton = this.window.getByTestId(this.confirmResetStateButtonSelector);
        await resetButton.waitFor({ state: 'visible', timeout: 1000 });
        // If the waitFor resolves successfully, click the reset button
        await resetButton.click();
        await this.waitForElementToDisappear(this.toastMessageSelector, 6000, 6000);
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
    return await this.getText(this.invalidPasswordMessageSelector);
  }

  async getLoginEmailErrorMessage() {
    return await this.getText(this.invalidEmailMessageSelector);
  }
}

module.exports = LoginPage;
