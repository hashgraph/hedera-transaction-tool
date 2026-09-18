import { test } from '@playwright/test';
import { setupRegistrationSuite } from '../helpers/fixtures/registrationSuite.js';

test.describe('Registration keychain tests @local-basic', () => {
  const suite = setupRegistrationSuite();

  test.skip(
    '"Sign in with Keychain" button is visible when OS keychain is available (1.3.1)',
    async () => {
      // TODO: macOS only — requires OS keychain to be available
      // Platform gate: test.skip(process.platform !== 'darwin', 'macOS keychain only')
      // Fixture: uses setupRegistrationSuite() — same as registrationTests.test.ts
      //
      // Page object additions needed on RegistrationPage:
      //   - Add selector: keychainSignInButtonSelector = 'button-sign-in-with-keychain'
      //   - Add method: async clickOnSignInWithKeychainButton()
      //   - Add method: async isKeychainSignInButtonVisible() -> boolean
      //
      // Steps:
      //   const isVisible = await suite.registrationPage.isKeychainSignInButtonVisible();
      //   expect(isVisible).toBe(true);
    },
  );

  test.skip('User can register using OS keychain (1.3.2)', async () => {
    // TODO: macOS only — requires OS keychain to be available
    // Platform gate: test.skip(process.platform !== 'darwin', 'macOS keychain only')
    // Fixture: uses setupRegistrationSuite() — same as registrationTests.test.ts
    //
    // Page object additions needed on RegistrationPage:
    //   - Add selector: keychainSignInButtonSelector = 'button-sign-in-with-keychain'
    //   - Add method: async clickOnSignInWithKeychainButton()
    //   - Add method: async completeRegistrationWithKeychain(email: string)
    //     (mirrors completeRegistration but uses keychain instead of password)
    //   - Add method: async isKeychainSignInButtonVisible() -> boolean
    //
    // Steps:
    //   await suite.registrationPage.clickOnSignInWithKeychainButton();
    //   await suite.registrationPage.completeRegistrationWithKeychain(testEmail);
    //   expect(await suite.registrationPage.verifyUserExists(testEmail)).toBe(true);
  });
});
