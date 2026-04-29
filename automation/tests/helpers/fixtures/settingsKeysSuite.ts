import { Page, test } from '@playwright/test';
import { LoginPage } from '../../../pages/LoginPage.js';
import { RegistrationPage } from '../../../pages/RegistrationPage.js';
import { SettingsPage } from '../../../pages/SettingsPage.js';
import type { TransactionToolApp } from '../../../utils/runtime/appSession.js';
import { createSeededLocalUserSession } from '../../../utils/seeding/localUserSeeding.js';
import { setupLocalSuiteApp, teardownLocalSuiteApp } from '../bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../../utils/setup/sharedTestEnvironment.js';

export function setupSettingsKeysSuite() {
  let app: TransactionToolApp;
  let window: Page;
  let registrationPage: RegistrationPage;
  let loginPage: LoginPage;
  let settingsPage: SettingsPage;
  let isolationContext: ActivatedTestIsolationContext | null = null;
  const credentials = { email: '', password: '' };

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
    credentials.email = seededUser.email;
    credentials.password = seededUser.password;
    await settingsPage.clickOnSettingsButton();
  });

  return {
    get credentials() {
      return credentials;
    },
    get registrationPage() {
      return registrationPage;
    },
    get loginPage() {
      return loginPage;
    },
    get settingsPage() {
      return settingsPage;
    },
  };
}
