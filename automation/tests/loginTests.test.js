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
const { resetDbState } = require('../utils/databaseUtil');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage;
let loginPage;

test.describe('Login tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    await loginPage.logout();
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
    const passwordErrorMessage = (await loginPage.getLoginPasswordErrorMessage()).trim();

    expect(passwordErrorMessage).toBe('Invalid password');
  });

  test('Verify that login with incorrect email shows an error message', async () => {
    const incorrectEmail = globalCredentials.email + '123';
    await loginPage.waitForToastToDisappear();
    await loginPage.login(incorrectEmail, globalCredentials.password);
    const passwordErrorMessage = (await loginPage.getLoginEmailErrorMessage()).trim();

    expect(passwordErrorMessage).toBe('Invalid e-mail');
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
    await resetAppState(window, app);
    // Assuming we have reset the account, and we land on the registration page, we confirm that we see password field.
    const isConfirmPasswordVisible = await registrationPage.isConfirmPasswordFieldVisible();
    expect(isConfirmPasswordVisible).toBe(true);
  });
});
