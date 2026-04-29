import { Page } from '@playwright/test';
import { BasePage } from './BasePage.js';

export class LoginPage extends BasePage {
  // AppModal currently reuses the same modal test id for multiple dialog types.
  // Treat only transaction-confirm action buttons as blocking for login.
  private readonly blockingModalActionSelectors = [
    '[data-testid="modal-confirm-transaction"][style*="display: block"] [data-testid="button-sign-transaction"]',
    '[data-testid="modal-confirm-transaction"][style*="display: block"] [data-testid="button-cancel-transaction"]',
    '[data-testid="modal-confirm-transaction"][style*="display: block"] [data-testid="button-sign-org-transaction"]',
    '[data-testid="modal-confirm-transaction"][style*="display: block"] [data-testid="button-cancel-org-transaction"]',
  ] as const;

  constructor(window: Page) {
    super(window);
  }

  /* Selectors */

  // Inputs
  emailInputSelector = 'input-email';
  passwordInputSelector = 'input-password';
  confirmPasswordInputSelector = 'input-password-confirm';
  encryptPasswordInputSelector = 'input-encrypt-password';

  // Buttons
  signInButtonSelector = 'button-login';
  importantNoteModalButtonSelector = 'button-understand-agree';
  rejectKeyChainButtonSelector = 'button-refuse-key-chain-mode';
  rejectMigrationButtonSelector = 'button-refuse-migration';
  resetStateButtonSelector = 'link-reset';
  confirmResetStateButtonSelector = 'button-reset';
  cancelResetStateButtonSelector = 'button-reset-cancel';
  keepLoggedInCheckboxSelector = 'checkbox-remember';
  logoutButtonSelector = 'button-logout';
  settingsButtonSelector = 'button-menu-settings';
  profileTabButtonSelector = 'tab-4';
  cancelEncryptPasswordButtonSelector = 'button-cancel-encrypt-password';

  // Labels
  emailLabelSelector = 'label-email';
  passwordLabelSelector = 'label-password';

  // Messages
  toastMessageSelector = 'css=.v-toast__text';
  visibleToastMessageSelector = 'css=.v-toast__text:visible';
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

  async dismissStartupPrompts(canMigrate: boolean) {
    await this.closeImportantNoteModal();

    if (canMigrate) {
      await this.closeMigrationModal();
    }

    if (process.platform === 'darwin') {
      await this.closeKeyChainModal();
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

  async isResetAccountLinkVisible() {
    return await this.isElementVisible(this.resetStateButtonSelector);
  }

  async clickOnResetAccountLink() {
    await this.dismissKnownBlockingModals();

    if (await this.isResetDataModalVisible()) {
      return;
    }

    try {
      await this.click(this.resetStateButtonSelector);
    } catch {
      await this.dismissKnownBlockingModals();
      await this.pressKey('Escape');
      await this.click(this.resetStateButtonSelector);
    }
  }

  async isResetDataModalVisible() {
    return await this.isElementVisible(this.confirmResetStateButtonSelector);
  }

  async clickOnResetDataConfirmButton() {
    await this.click(this.confirmResetStateButtonSelector);
  }

  async clickOnResetDataCancelButton() {
    await this.click(this.cancelResetStateButtonSelector);
  }

  async login(email: string, password: string) {
    await this.typeEmail(email);
    await this.typePassword(password);
    await this.clickSignIn();
  }

  async getAuthMode(timeout: number = this.LONG_TIMEOUT): Promise<'registration' | 'signIn'> {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (await this.isElementVisible(this.confirmPasswordInputSelector, null, this.SHORT_TIMEOUT)) {
        return 'registration';
      }

      if (await this.isElementVisible(this.resetStateButtonSelector, null, this.SHORT_TIMEOUT)) {
        return 'signIn';
      }

      await this.wait(this.SHORT_TIMEOUT);
    }

    throw new Error('Unable to determine auth mode from startup screen');
  }

  async isRegistrationMode(timeout: number = this.LONG_TIMEOUT) {
    return (await this.getAuthMode(timeout)) === 'registration';
  }

  async isSignInMode(timeout: number = this.LONG_TIMEOUT) {
    return (await this.getAuthMode(timeout)) === 'signIn';
  }

  async assertRegistrationMode(context = 'startup') {
    const authMode = await this.getAuthMode();

    if (authMode !== 'registration') {
      throw new Error(`Expected registration mode during ${context}, but sign-in mode was shown`);
    }
  }

  async assertSignInMode(context = 'startup') {
    const authMode = await this.getAuthMode();

    if (authMode !== 'signIn') {
      throw new Error(`Expected sign-in mode during ${context}, but registration mode was shown`);
    }
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

  async clickOnKeepLoggedInCheckbox() {
    await this.click(this.keepLoggedInCheckboxSelector);
  }

  async isKeepLoggedInChecked() {
    return await this.isChecked(this.keepLoggedInCheckboxSelector);
  }

  async clickSignIn() {
    await this.dismissKnownBlockingModals();

    try {
      await this.waitForBlockingModalToClose(this.SHORT_TIMEOUT);
    } catch {
      // In some flows a stale transaction confirmation modal can remain open and
      // intercept pointer events on top of the auth screen.
      await this.dismissKnownBlockingModals();
      await this.pressKey('Escape');
      await this.pressKey('Escape');
      await this.waitForBlockingModalToClose();
    }
    await this.click(this.signInButtonSelector, 0, this.LONG_TIMEOUT);
  }

  private async dismissKnownBlockingModals() {
    await this.closeUserPasswordModal();
    await this.closeImportantNoteModal();
    await this.closeMigrationModal();

    if (process.platform === 'darwin') {
      await this.closeKeyChainModal();
    }
  }

  async closeUserPasswordModal() {
    const isPasswordModalVisible = await this.isElementVisible(
      this.encryptPasswordInputSelector,
      null,
      this.SHORT_TIMEOUT,
    );

    if (isPasswordModalVisible) {
      await this.click(this.cancelEncryptPasswordButtonSelector);
      await this.waitForElementToDisappear(this.encryptPasswordInputSelector);
    }
  }

  async waitForBlockingModalToClose(timeout: number = this.VERY_LONG_TIMEOUT) {
    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      if (!(await this.hasVisibleBlockingModalAction())) {
        return;
      }

      await this.pressKey('Escape');
      await this.wait(this.SHORT_TIMEOUT);
    }

    throw new Error(
      `Blocking transaction confirmation modal did not close within ${timeout} ms`,
    );
  }

  private async hasVisibleBlockingModalAction() {
    for (const selector of this.blockingModalActionSelectors) {
      if (await this.isElementVisible(selector, 0, this.SHORT_TIMEOUT)) {
        return true;
      }
    }

    return false;
  }

  async waitForToastToDisappear() {
    const hasVisibleToast = await this.isElementVisible(
      this.visibleToastMessageSelector,
      0,
      this.SHORT_TIMEOUT,
    );

    if (!hasVisibleToast) {
      return;
    }

    const toastHidden = await this.isElementHidden(
      this.visibleToastMessageSelector,
      0,
      this.VERY_LONG_TIMEOUT,
    );

    if (!toastHidden) {
      console.log('Visible toast did not disappear within timeout; continuing.');
    }
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
