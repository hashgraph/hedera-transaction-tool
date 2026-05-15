import { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  closeApp,
  resetAppState,
  setupApp,
  type TransactionToolApp,
} from '../../utils/runtime/appSession.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { TransactionPage } from '../../pages/TransactionPage.js';
import { createSeededLocalUserSession } from '../../utils/seeding/localUserSeeding.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
const globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let transactionPage: TransactionPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Login tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    globalCredentials.email = seededUser.email;
    globalCredentials.password = seededUser.password;
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
    expect(await transactionPage.isCreateNewTransactionButtonVisible()).toBe(true);
  });

  test('Verify "Keep me logged in" checkbox persists session', async () => {
    expect(await loginPage.isKeepLoggedInChecked()).toBe(false);
    await loginPage.clickOnKeepLoggedInCheckbox();
    expect(await loginPage.isKeepLoggedInChecked()).toBe(true);

    await loginPage.login(globalCredentials.email, globalCredentials.password);
    expect(await transactionPage.isCreateNewTransactionButtonVisible()).toBe(true);

    await closeApp(app);
    ({ app, window } = await setupApp({ preserveLocalState: true }));
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);

    expect(await loginPage.isSettingsButtonVisible()).toBe(true);
    expect(await transactionPage.isCreateNewTransactionButtonVisible(10000)).toBe(true);
  });

  test('Verify resetting account', async () => {
    await loginPage.logout();
    await resetAppState(window, app);
    await loginPage.assertRegistrationMode('account reset');
    expect(await loginPage.isRegistrationMode()).toBe(true);
  });
});
