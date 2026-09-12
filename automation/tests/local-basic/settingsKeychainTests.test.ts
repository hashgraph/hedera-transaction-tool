import { Page, test } from '@playwright/test';
import type { TransactionToolApp } from '../../utils/runtime/appSession.js';
import { LoginPage } from '../../pages/LoginPage.js';
import { SettingsPage } from '../../pages/SettingsPage.js';
import {
  setupLocalSuiteApp,
  teardownLocalSuiteApp,
} from '../helpers/bootstrap/localSuiteBootstrap.js';
import type { ActivatedTestIsolationContext } from '../../utils/setup/sharedTestEnvironment.js';

let app: TransactionToolApp;
let window: Page;
let loginPage: LoginPage;
let settingsPage: SettingsPage;
let isolationContext: ActivatedTestIsolationContext | null = null;

test.describe('Settings keychain tests @local-basic', () => {
  test.beforeAll(async () => {
    ({ app, window, isolationContext } = await setupLocalSuiteApp(test.info()));
  });

  test.afterAll(async () => {
    await teardownLocalSuiteApp(app, isolationContext);
  });

  test.beforeEach(async () => {
    loginPage = new LoginPage(window);
    settingsPage = new SettingsPage(window);
  });

  test.skip(
    'Keychain user sees reset application form instead of password change in Settings → Profile (3.5.8)',
    async () => {
      // TODO: macOS only — requires registering with OS keychain first (see test 1.3.2)
      // Platform gate: test.skip(process.platform !== 'darwin', 'macOS keychain only')
      // Fixture: uses setupLocalSuiteApp/teardownLocalSuiteApp — same as settingsProfileTests.test.ts
      //
      // Page object additions needed on SettingsPage:
      //   - Add method: async isPasswordChangeSectionVisible() -> boolean
      //   - Add method: async isResetApplicationFormVisible() -> boolean
      //
      // Pre-condition (beforeEach):
      //   Register a new user via OS keychain (calls clickOnSignInWithKeychainButton +
      //   completeRegistrationWithKeychain on RegistrationPage — see test 1.3.2)
      //   Then log in and navigate to Settings → Profile.
      //
      // Steps:
      //   await settingsPage.clickOnSettingsButton();
      //   await settingsPage.clickOnProfileTab();
      //   expect(await settingsPage.isPasswordChangeSectionVisible()).toBe(false);
      //   expect(await settingsPage.isResetApplicationFormVisible()).toBe(true);
    },
  );
});
