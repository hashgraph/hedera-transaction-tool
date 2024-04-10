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

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage;
let loginPage;

test.describe('Login tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    await resetAppState(window);
    loginPage = new LoginPage(window);
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
    const incorrectPassword = globalCredentials.password + '123';
    await loginPage.login(globalCredentials.email, incorrectPassword);
    const passwordErrorMessage = (await loginPage.getLoginPasswordErrorMessage()).trim();

    expect(passwordErrorMessage).toBe('Invalid password.');
  });

  test('Verify that login with incorrect email shows an error message', async () => {
    const incorrectEmail = globalCredentials.email + '123';
    await loginPage.login(incorrectEmail, globalCredentials.password);
    const passwordErrorMessage = (await loginPage.getLoginEmailErrorMessage()).trim();

    expect(passwordErrorMessage).toBe('Invalid e-mail.');
  });

  test('Verify all essential elements are present on the login page', async () => {
    const allElementsAreCorrect = await loginPage.verifyLoginElements();

    expect(allElementsAreCorrect).toBe(true);
  });

  test('Verify successful login', async () => {
    await loginPage.login(globalCredentials.email, globalCredentials.password);
    // Assuming we have logged in, user should see the settings button
    const isButtonVisible = await loginPage.isSettingsButtonVisible();

    expect(isButtonVisible).toBe(true);
  });

  test('Verify resetting account', async () => {
    await loginPage.logout();
    await resetAppState(window);
    // Assuming we have reset the account, and we land on the registration page, we confirm that we see password field.
    const isConfirmPasswordVisible = await registrationPage.isConfirmPasswordFieldVisible();

    expect(isConfirmPasswordVisible).toBe(true);
  });
});
