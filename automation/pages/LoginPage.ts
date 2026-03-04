import { Page } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  constructor(window: Page) {
    super(window);
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
  toastMessageSelector = 'css=.v-toast__text';
  invalidPasswordMessageSelector = 'invalid-text-password';
  invalidEmailMessageSelector = 'invalid-text-email';

  async closeImportantNoteModal() {
    const isModal = await this.isElementVisible(this.importantNoteModalButtonSelector);
    if (isModal) {
      await this.click(this.importantNoteModalButtonSelector);
    }
  }

  async closeKeyChainModal() {
    const isModal = await this.isElementVisible(this.rejectKeyChainButtonSelector);
    if (isModal) {
      await this.click(this.rejectKeyChainButtonSelector);
    }
  }

  async closeMigrationModal() {
    const isModal = await this.isElementVisible(this.rejectMigrationButtonSelector);
    if (isModal) {
      await this.click(this.rejectMigrationButtonSelector);
    }
  }

  async resetForm() {
    await this.fill(this.emailInputSelector, '');
    await this.fill(this.passwordInputSelector, '');
  }

  async logout() {
    let isLogoutVisible = await this.isElementVisible(this.logoutButtonSelector, null, this.SHORT_TIMEOUT);

    if (!isLogoutVisible) {
      if (await this.isElementVisible(this.settingsButtonSelector, null, this.SHORT_TIMEOUT)) {
        await this.click(this.settingsButtonSelector);
      }

      if (await this.isElementVisible(this.profileTabButtonSelector, null, this.SHORT_TIMEOUT)) {
        await this.click(this.profileTabButtonSelector);
        isLogoutVisible = await this.isElementVisible(this.logoutButtonSelector);
      }
    }

    if (isLogoutVisible) {
      await this.click(this.logoutButtonSelector);
      await this.waitForElementToBeVisible(this.emailInputSelector);
    } else {
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

  async login(email: string, password: string) {
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
        await this.click(this.confirmResetStateButtonSelector);
        await this.waitForElementToDisappear(this.toastMessageSelector, this.DEFAULT_TIMEOUT, this.LONG_TIMEOUT);
      } catch (e) {
        console.log("The 'Reset' modal did not appear within the timeout.");
      }
    }
  }

  async typeEmail(email: string) {
    await this.fill(this.emailInputSelector, email);
  }

  async typePassword(password: string) {
    await this.fill(this.passwordInputSelector, password);
  }

  async clickSignIn() {
    await this.click(this.signInButtonSelector);
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
