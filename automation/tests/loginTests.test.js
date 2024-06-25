const { test } = require('@playwright/test');
const {
  setupApp,
  resetAppState,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
} = require('../utils/util');
const RegistrationPage = require('../pages/RegistrationPage.js');
const { expect } = require('playwright/test');
const LoginPage = require('../pages/LoginPage');
const { allure } = require('allure-playwright');
const { Severity } = require('allure-js-commons');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage;
let loginPage;

test.describe('Login tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    await loginPage.logout();
    await resetAppState(window);
    registrationPage = new RegistrationPage(window);

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );
  });

  test.afterAll(async () => {
    await loginPage.logout();
    await resetAppState(window);

    await closeApp(app);
  });

  test.beforeEach(async () => {
    await loginPage.logout();
  });

  test('Verify that login with incorrect password shows an error message', async () => {
    await allure.severity(Severity.TRIVIAL);

    const incorrectPassword = globalCredentials.password + '123';
    await loginPage.waitForToastToDisappear();
    await loginPage.login(globalCredentials.email, incorrectPassword);
    const passwordErrorMessage = (await loginPage.getLoginPasswordErrorMessage()).trim();

    expect(passwordErrorMessage).toBe('Invalid password.');
  });

  test('Verify that login with incorrect email shows an error message', async () => {
    await allure.severity(Severity.TRIVIAL);

    const incorrectEmail = globalCredentials.email + '123';
    await loginPage.waitForToastToDisappear();
    await loginPage.login(incorrectEmail, globalCredentials.password);
    const passwordErrorMessage = (await loginPage.getLoginEmailErrorMessage()).trim();

    expect(passwordErrorMessage).toBe('Invalid e-mail.');
  });

  test('Verify all essential elements are present on the login page', async () => {
    await allure.severity(Severity.NORMAL);

    const allElementsAreCorrect = await loginPage.verifyLoginElements();
    expect(allElementsAreCorrect).toBe(true);
  });

  test('Verify successful login', async () => {
    await allure.severity(Severity.BLOCKER);

    await loginPage.login(globalCredentials.email, globalCredentials.password);
    // Assuming we have logged in, user should see the settings button
    const isButtonVisible = await loginPage.isSettingsButtonVisible();

    expect(isButtonVisible).toBe(true);
  });

  test('Verify resetting account', async () => {
    await allure.severity(Severity.NORMAL);

    await loginPage.logout();
    await resetAppState(window);
    // Assuming we have reset the account, and we land on the registration page, we confirm that we see password field.
    const isConfirmPasswordVisible = await registrationPage.isConfirmPasswordFieldVisible();
    expect(isConfirmPasswordVisible).toBe(true);
  });
});
