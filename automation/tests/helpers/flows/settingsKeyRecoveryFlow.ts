import { expect } from '@playwright/test';
import type { LoginPage } from '../../../pages/LoginPage.js';
import type { RegistrationPage } from '../../../pages/RegistrationPage.js';
import type { SettingsPage } from '../../../pages/SettingsPage.js';

export interface RestoreKeyOptions {
  expectSuccessToast?: boolean;
  waitForToastAfterSave?: boolean;
  waitForToastBeforeNickname?: boolean;
}

export async function restoreKeyFromSettings(
  settingsPage: SettingsPage,
  registrationPage: RegistrationPage,
  loginPage: LoginPage,
  {
    expectSuccessToast = false,
    waitForToastAfterSave = false,
    waitForToastBeforeNickname = true,
  }: RestoreKeyOptions = {},
) {
  await settingsPage.clickOnRestoreButton();

  await registrationPage.fillAllMissingRecoveryPhraseWords();
  await settingsPage.clickOnContinuePhraseButton();

  const currentIndex = parseInt(settingsPage.currentIndex);
  await settingsPage.fillInIndex(currentIndex);
  await settingsPage.clickOnIndexContinueButton();

  if (waitForToastBeforeNickname) {
    await loginPage.waitForToastToDisappear();
  }

  await settingsPage.fillInNickname('testNickname' + settingsPage.currentIndex);
  await settingsPage.clickOnNicknameContinueButton();

  if (expectSuccessToast) {
    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Key pair saved');
  }

  if (waitForToastAfterSave) {
    await loginPage.waitForToastToDisappear();
  }

  return currentIndex;
}
