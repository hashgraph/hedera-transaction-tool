import { expect, test } from '@playwright/test';
import { setupRegistrationSuite } from '../helpers/fixtures/registrationSuite.js';

test.describe('Registration form validation tests @local-basic', () => {
  const suite = setupRegistrationSuite();

  test('Verify all elements are present on the registration page', async () => {
    const allElementsAreCorrect = await suite.registrationPage.verifyRegistrationElements();
    expect(allElementsAreCorrect).toBe(true);
  });

  test('Verify rejection of invalid email format in the registration form', async () => {
    await suite.registrationPage.typeEmail('wrong.gmail');
    await suite.registrationPage.typePassword('test');

    const errorMessage = ((await suite.registrationPage.getEmailErrorMessage()) ?? '').trim();

    expect(errorMessage).toBe('Invalid e-mail');
  });

  test('Verify e-mail field accepts valid format', async () => {
    await suite.registrationPage.typeEmail('test23@test.com');
    await suite.registrationPage.typePassword('test');

    const isErrorMessageHidden = await suite.registrationPage.isEmailErrorMessageHidden();

    expect(isErrorMessageHidden).toBe(true);
  });

  test('Verify password field rejects empty password', async () => {
    await suite.registrationPage.typeEmail('test@test.co');
    await suite.registrationPage.typePassword('test');

    //this is to trigger validation
    await suite.registrationPage.typeEmail('m');

    const errorMessage = ((await suite.registrationPage.getPasswordErrorMessage()) ?? '').trim();

    expect(errorMessage).toBe('Invalid password');
  });

  test('Verify confirm password field rejects mismatching passwords', async () => {
    await suite.registrationPage.typePassword('matching');
    await suite.registrationPage.typeConfirmPassword('not-matching');
    await suite.registrationPage.typeEmail('test@test.com');

    const errorMessage = (
      (await suite.registrationPage.getConfirmPasswordErrorMessage()) ?? ''
    ).trim();

    expect(errorMessage).toBe('Password do not match');
  });
});
