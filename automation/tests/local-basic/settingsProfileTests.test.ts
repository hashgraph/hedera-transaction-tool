import { Page, expect, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import { generateRandomPassword } from '../../utils/data/random.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
const globalCredentials = { email: '', password: '' };
let registrationPage: RegistrationPage;
let loginPage: LoginPage;
let settingsPage: SettingsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Settings profile tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    settingsPage = new SettingsPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    registrationPage = new RegistrationPage(window, seededUser.recoveryPhraseWordMap);
    globalCredentials.email = seededUser.email;
    globalCredentials.password = seededUser.password;
    await settingsPage.clickOnSettingsButton();
  });

  test('Verify user can change password', async () => {
    await settingsPage.clickOnProfileTab();

    await settingsPage.fillInCurrentPassword(globalCredentials.password);
    const newPassword = generateRandomPassword();
    await settingsPage.fillInNewPassword(newPassword);
    await settingsPage.clickOnChangePasswordButton();
    expect(await settingsPage.isConfirmChangePasswordButtonVisible()).toBe(true);
    await settingsPage.clickOnConfirmChangePassword();
    expect(await settingsPage.isElementVisible(settingsPage.closeButtonSelector)).toBe(true);
    await settingsPage.clickOnCloseButton();
    globalCredentials.password = newPassword;
    await loginPage.logout();

    await loginPage.login(globalCredentials.email, globalCredentials.password);
    const isButtonVisible = await loginPage.isSettingsButtonVisible();
    expect(isButtonVisible).toBe(true);
  });

  test('Verify logout redirects user to sign-in screen', async () => {
    await settingsPage.clickOnProfileTab();
    await loginPage.logout();
    await loginPage.assertSignInMode('logout redirect');
    expect(await loginPage.isSignInMode()).toBe(true);
  });

  test('Verify wrong current password shows error when changing password', async () => {
    await settingsPage.clickOnProfileTab();
    await settingsPage.fillInCurrentPassword(`${globalCredentials.password}x`);
    await settingsPage.fillInNewPassword(generateRandomPassword());
    await settingsPage.clickOnChangePasswordButton();
    await settingsPage.clickOnConfirmChangePassword();

    const toastMessage = await registrationPage.getToastMessageByVariant('error');
    expect(toastMessage).toContain('Incorrect current password');
  });
});
