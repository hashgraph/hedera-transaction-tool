import { Page } from '@playwright/test';
import { test, expect } from '@playwright/test';
import {
  setupApp,
  resetAppState,
  closeApp,
} from '../utils/automationSupport.js';
import { LoginPage } from '../pages/LoginPage.js';
import { createSeededLocalUserSession } from '../utils/localBaseline.js';
import {
  activateSuiteIsolation,
  cleanupIsolation,
  resetLocalStateForSuite,
  resetLocalStateForTeardown,
  type ActivatedTestIsolationContext,
} from '../utils/sharedTestEnvironment.js';

let app: Awaited<ReturnType<typeof setupApp>>['app'];
let window: Page;
const globalCredentials = { email: '', password: '' };
let loginPage: LoginPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Login tests @local-basic', () => {
  test.beforeAll(async () => {
    isolationContext = await activateSuiteIsolation(test.info());
    await resetLocalStateForSuite();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    const seededUser = await createSeededLocalUserSession(window, loginPage);
    globalCredentials.email = seededUser.email;
    globalCredentials.password = seededUser.password;
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetLocalStateForTeardown();
    await cleanupIsolation(isolationContext);
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
    await loginPage.assertRegistrationMode('account reset');
    expect(await loginPage.isRegistrationMode()).toBe(true);
  });
});
