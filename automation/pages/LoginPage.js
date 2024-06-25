const BasePage = require('./BasePage');
import { allure } from 'allure-playwright';

class LoginPage extends BasePage {
  constructor(window) {
    super(window);
    this.window = window;
  }

  /* Selectors */
  emailInputSelector = 'input-email';
  passwordInputSelector = 'input-password';

  signInButtonSelector = 'button-login';
  importantNoteModalButtonSelector = 'button-understand-agree';
  resetStateButtonSelector = 'link-reset';
  confirmResetStateButtonSelector = 'button-reset';
  keepLoggedInCheckboxSelector = 'checkbox-remember';
  logoutButtonSelector = 'button-logout';
  settingsButtonSelector = 'button-menu-settings';

  emailLabelSelector = 'label-email';
  passwordLabelSelector = 'label-password';

  toastMessageSelector = '.v-toast__text';
  invalidPasswordMessageSelector = 'invalid-text-password';
  invalidEmailMessageSelector = 'invalid-text-email';

  async closeImportantNoteModal() {
    await allure.step('Close Important Note Modal', async () => {
      const modalButton = this.window.getByTestId(this.importantNoteModalButtonSelector);
      await modalButton.waitFor({ state: 'visible', timeout: 500 }).catch(e => {});
      if (await modalButton.isVisible()) {
        await modalButton.click();
      }
    });
  }

  async resetForm() {
    await allure.step('Reset Form', async () => {
      await this.fillByTestId(this.emailInputSelector, '');
      await this.fillByTestId(this.passwordInputSelector, '');
    });
  }

  async logout() {
    await allure.step('Logout', async () => {
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
    });
  }

  async verifyLoginElements() {
    return await allure.step('Verify Login Elements', async () => {
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
    });
  }

  async login(email, password) {
    await allure.step('Login', async () => {
      await this.typeEmail(email);
      await this.typePassword(password);
      await this.clickSignIn();
    });
  }

  async resetState() {
    await allure.step('Reset State', async () => {
      const initialResetButtonExists = await this.isElementVisible(this.resetStateButtonSelector);
      if (initialResetButtonExists) {
        try {
          await this.clickByTestId(this.resetStateButtonSelector);
        } catch (e) {
          console.log('Failed to click on the reset link');
        }
        try {
          const resetButton = this.window.getByTestId(this.confirmResetStateButtonSelector);
          await resetButton.waitFor({ state: 'visible', timeout: 1000 });
          await resetButton.click();
          await this.waitForToastToDisappear();
        } catch (e) {
          console.log("The 'Reset' modal did not appear within the timeout.");
        }
      }
    });
  }

  async typeEmail(email) {
    await allure.step('Type Email', async () => {
      await this.window.getByTestId(this.emailInputSelector).fill(email);
    });
  }

  async typePassword(password) {
    await allure.step('Type Password', async () => {
      await this.window.getByTestId(this.passwordInputSelector).fill(password);
    });
  }

  async clickSignIn() {
    await allure.step('Click Sign In', async () => {
      await this.window.getByTestId(this.signInButtonSelector).click();
    });
  }

  async waitForToastToDisappear() {
    await allure.step('Wait For Toast To Disappear', async () => {
      await this.waitForElementToDisappear(this.toastMessageSelector);
    });
  }

  async isSettingsButtonVisible() {
    return await allure.step('Is Settings Button Visible', async () => {
      return await this.isElementVisible(this.settingsButtonSelector);
    });
  }

  async getLoginPasswordErrorMessage() {
    return await allure.step('Get Login Password Error Message', async () => {
      return await this.getTextByTestId(this.invalidPasswordMessageSelector);
    });
  }

  async getLoginEmailErrorMessage() {
    return await allure.step('Get Login Email Error Message', async () => {
      return await this.getTextByTestId(this.invalidEmailMessageSelector);
    });
  }
}

module.exports = LoginPage;
