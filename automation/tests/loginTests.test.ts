import { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  setupApp,
  resetAppState,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
} from '../utils/automationSupport.js';
import { RegistrationPage } from '../pages/RegistrationPage.js';
import { LoginPage } from '../pages/LoginPage.js';
import { resetDbState } from '../utils/databaseUtil.js';

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
const globalCredentials = { email: '', password: '' };
let registrationPage: RegistrationPage;
let loginPage: LoginPage;

test.describe('Login tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);

    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test.beforeEach(async () => {
    await loginPage.logout();
  });

  test('Verify that login with incorrect password shows an error message', async () => {
    const incorrectPassword = globalCredentials.password + '123';
    await loginPage.waitForToastToDisappear();
    await loginPage.login(globalCredentials.email, incorrectPassword);
    const passwordErrorMessage = (await loginPage.getLoginPasswordErrorMessage())?.trim();
    expect(passwordErrorMessage).toBe('Invalid password');
  });

  test('Verify that login with incorrect email shows an error message', async () => {
    const incorrectEmail = globalCredentials.email + '123';
    await loginPage.waitForToastToDisappear();
    await loginPage.login(incorrectEmail, globalCredentials.password);
    const passwordErrorMessage = (await loginPage.getLoginEmailErrorMessage())?.trim();
    expect(passwordErrorMessage).toBe('Invalid e-mail');
  });

  test('Verify all essential elements are present on the login page', async () => {
    const allElementsAreCorrect = await loginPage.verifyLoginElements();
    expect(allElementsAreCorrect).toBe(true);
  });

  test('Verify successful login', async () => {
    await loginPage.login(globalCredentials.email, globalCredentials.password);
    const isButtonVisible = await loginPage.isSettingsButtonVisible();
    expect(isButtonVisible).toBe(true);
  });

  test('Verify resetting account', async () => {
    await loginPage.logout();
    await resetAppState(window, app);
    const isConfirmPasswordVisible = await registrationPage.isConfirmPasswordFieldVisible();
    expect(isConfirmPasswordVisible).toBe(true);
  });
});
