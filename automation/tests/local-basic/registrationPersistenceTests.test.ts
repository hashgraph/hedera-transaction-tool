import { expect, test } from '@playwright/test';
import { setupRegistrationSuite } from '../helpers/fixtures/registrationSuite.js';

test.describe('Registration persistence tests @local-basic', () => {
  const suite = setupRegistrationSuite();

  test('Verify successful registration through "Create New" flow', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.register(
      credentials.email,
      credentials.password,
      credentials.password,
    );

    const isTabVisible = await suite.registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await suite.registrationPage.clickOnCreateNewTab();
    await suite.registrationPage.clickOnUnderstandCheckbox();
    await suite.registrationPage.clickOnGenerateButton();

    await suite.registrationPage.captureRecoveryPhraseWords();
    await suite.registrationPage.clickOnUnderstandCheckbox();
    await suite.registrationPage.clickOnVerifyButton();

    await suite.registrationPage.fillAllMissingRecoveryPhraseWords();
    await suite.registrationPage.clickOnNextButton();

    await suite.registrationPage.clickOnFinalNextButtonWithRetry();

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('Key Pair saved successfully');
    expect(await suite.transactionPage.isCreateNewTransactionButtonVisible()).toBe(true);
  });

  test('Verify successful registration through "Import Existing" flow', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.register(
      credentials.email,
      credentials.password,
      credentials.password,
    );

    const isTabVisible = await suite.registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await suite.registrationPage.clickOnCreateNewTab();

    await suite.registrationPage.clickOnUnderstandCheckbox();
    await suite.registrationPage.clickOnGenerateButton();
    await suite.registrationPage.captureRecoveryPhraseWords();

    await suite.registrationPage.clickOnImportTab();

    await suite.registrationPage.fillAllMissingRecoveryPhraseWords();
    await suite.registrationPage.scrollToNextImportButton();
    await suite.registrationPage.clickOnNextImportButton();

    await suite.registrationPage.clickOnFinalNextButtonWithRetry();

    const toastMessage = await suite.registrationPage.getToastMessage();
    expect(toastMessage).toBe('Key Pair saved successfully');
    expect(await suite.transactionPage.isCreateNewTransactionButtonVisible()).toBe(true);
  });

  test('Verify user is stored in the database after registration', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.completeRegistration(credentials.email, credentials.password);

    const userExists = await suite.registrationPage.verifyUserExists(credentials.email);
    expect(userExists).toBe(true);
  });

  test('Verify user public key is stored in the database after registration', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.register(
      credentials.email,
      credentials.password,
      credentials.password,
    );

    const isTabVisible = await suite.registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await suite.registrationPage.clickOnCreateNewTab();
    await suite.registrationPage.clickOnUnderstandCheckbox();
    await suite.registrationPage.clickOnGenerateButton();

    await suite.registrationPage.captureRecoveryPhraseWords();
    await suite.registrationPage.clickOnUnderstandCheckbox();
    await suite.registrationPage.clickOnVerifyButton();

    await suite.registrationPage.fillAllMissingRecoveryPhraseWords();
    await suite.registrationPage.clickOnNextButton();

    const publicKeyFromApp = await suite.registrationPage.getPublicKey();

    await suite.registrationPage.clickOnFinalNextButtonWithRetry();

    const publicKeyFromDb = await suite.registrationPage.getPublicKeyByEmail(credentials.email);

    expect(publicKeyFromApp).toBe(publicKeyFromDb);
  });

  test('Verify user private key is stored in the database after registration', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.completeRegistration(credentials.email, credentials.password);

    const privateKeyExists = await suite.registrationPage.verifyPrivateKeyExistsByEmail(
      credentials.email,
    );

    expect(privateKeyExists).toBe(true);
  });

  test('Verify user is deleted from the database after resetting account', async () => {
    // BeforeEach executes logout and reset account state, so we just verify it's no longer existing
    await new Promise(resolve => setTimeout(resolve, 500));
    const userExists = await suite.registrationPage.verifyUserExists(suite.credentials.email);
    expect(userExists).toBe(false);
  });

  test('Verify user key pair is deleted from the database after resetting account', async () => {
    // BeforeEach executes logout and reset account state, so we just verify it's no longer existing
    const publicKeyExists = await suite.registrationPage.verifyPublicKeyExistsByEmail(
      suite.credentials.email,
    );
    expect(publicKeyExists).toBe(false);

    const privateKeyExists = await suite.registrationPage.verifyPrivateKeyExistsByEmail(
      suite.credentials.email,
    );
    expect(privateKeyExists).toBe(false);
  });
});
