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
import { allure } from 'allure-playwright';

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
    await allure.label('feature', 'Login');
    await allure.label('severity', 'normal');
    let passwordErrorMessage;
    const incorrectPassword = globalCredentials.password + '123';
    await allure.step('Wait for any previous toasts to disappear', async () => {
      await loginPage.waitForToastToDisappear();
    });
    await allure.step('Attempt to login with incorrect password', async () => {
      await loginPage.login(globalCredentials.email, incorrectPassword);
    });
    await allure.step('Get the password error message', async () => {
      passwordErrorMessage = (await loginPage.getLoginPasswordErrorMessage()).trim();
    });
    await allure.step('Verify the error message', async () => {
      expect(passwordErrorMessage).toBe('Invalid password.');
    });
  });

  test('Verify that login with incorrect email shows an error message', async () => {
    await allure.label('feature', 'Login');
    await allure.label('severity', 'normal');

    let emailErrorMessage;
    const incorrectEmail = globalCredentials.email + '123';
    await allure.step('Wait for any previous toasts to disappear', async () => {
      await loginPage.waitForToastToDisappear();
    });
    await allure.step('Attempt to login with incorrect email', async () => {
      await loginPage.login(incorrectEmail, globalCredentials.password);
    });
    await allure.step('Get the password error message', async () => {
      emailErrorMessage = (await loginPage.getLoginEmailErrorMessage()).trim();
    });

    await allure.step('Verify the error message', async () => {
      expect(emailErrorMessage).toBe('Invalid e-mail.');
    });
  });

  test('Verify all essential elements are present on the login page', async () => {
    await allure.label('feature', 'Login');
    await allure.label('severity', 'normal');

    const allElementsAreCorrect = await loginPage.verifyLoginElements();
    await allure.step('Verify login elements', async () => {
      expect(allElementsAreCorrect).toBe(true);
    });
  });

  test('Verify successful login', async () => {
    await allure.label('feature', 'Login');
    await allure.label('severity', 'critical');

    await allure.step('Attempt to login with correct credentials', async () => {
      await loginPage.login(globalCredentials.email, globalCredentials.password);
    });
    await allure.step('Verify settings button visibility', async () => {
      // Assuming we have logged in, user should see the settings button
      const isButtonVisible = await loginPage.isSettingsButtonVisible();

      expect(isButtonVisible).toBe(true);
    });
  });

  test('Verify resetting account', async () => {
    await allure.label('feature', 'Account Reset');
    await allure.label('severity', 'critical');

    await allure.step('Attempt logout', async () => {
      await loginPage.logout();
    });
    await allure.step('Reset app state', async () => {
      await resetAppState(window);
    });
    // Assuming we have reset the account, and we land on the registration page, we confirm that we see password field.
    await allure.step('Verify account is reset', async () => {
      const isConfirmPasswordVisible = await registrationPage.isConfirmPasswordFieldVisible();
      expect(isConfirmPasswordVisible).toBe(true);
    });
  });
});
