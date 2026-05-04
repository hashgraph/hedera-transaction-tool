import { Page, expect, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { RegistrationPage } from '../../pages/RegistrationPage.js';
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
let registrationPage: RegistrationPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Account Reset tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);

    const seededUser = await createSeededLocalUserSession(window, loginPage);
    globalCredentials.email = seededUser.email;
    globalCredentials.password = seededUser.password;

    await loginPage.logout();
    await loginPage.assertSignInMode('account reset test bootstrap');
  });

  test('"Reset account" link is visible on login screen', async () => {
    expect(await loginPage.isResetAccountLinkVisible()).toBe(true);
  });

  test('Reset data modal appears on click', async () => {
    await loginPage.clickOnResetAccountLink();
    expect(await loginPage.isResetDataModalVisible()).toBe(true);

    await loginPage.clickOnResetDataCancelButton();
    expect(await loginPage.isSignInMode()).toBe(true);
  });

  test('User data is cleared after confirming reset', async () => {
    await loginPage.clickOnResetAccountLink();
    await loginPage.clickOnResetDataConfirmButton();

    await expect
      .poll(async () => await registrationPage.verifyUserExists(globalCredentials.email), {
        timeout: 5000,
        intervals: [250],
      })
      .toBe(false);
  });

  test('User is returned to registration mode after reset', async () => {
    await loginPage.clickOnResetAccountLink();
    await loginPage.clickOnResetDataConfirmButton();

    await loginPage.assertRegistrationMode('account reset confirmation');
    expect(await loginPage.isRegistrationMode()).toBe(true);
  });
});
