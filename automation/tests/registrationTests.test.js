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
const { resetDbState } = require('../utils/databaseUtil');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage;

test.describe('Registration tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
  });

  test.afterAll(async () => {
    await closeApp(app);
    await resetDbState();
  });

  test.beforeEach(async () => {
    await registrationPage.logoutForReset();
    await resetAppState(window, app);
  });

  test('Verify all elements are present on the registration page', async () => {
    const allElementsAreCorrect = await registrationPage.verifyRegistrationElements();
    expect(allElementsAreCorrect).toBe(true);
  });

  test('Verify rejection of invalid email format in the registration form', async () => {
    await registrationPage.typeEmail('wrong.gmail');
    await registrationPage.typePassword('test');

    const errorMessage = (await registrationPage.getEmailErrorMessage()).trim();

    expect(errorMessage).toBe('Invalid e-mail');
  });

  test('Verify e-mail field accepts valid format', async () => {
    await registrationPage.typeEmail('test23@test.com');
    await registrationPage.typePassword('test');

    const isErrorMessageVisible = await registrationPage.isEmailErrorMessageVisible();

    expect(isErrorMessageVisible).toBe(false);
  });

  test('Verify password field rejects empty password', async () => {
    await registrationPage.typeEmail('test@test.co');
    await registrationPage.typePassword('test');

    //this is to trigger validation
    await registrationPage.typeEmail('m');

    const errorMessage = (await registrationPage.getPasswordErrorMessage()).trim();

    expect(errorMessage).toBe('Invalid password');
  });

  test('Verify confirm password field rejects mismatching passwords', async () => {
    await registrationPage.typePassword('matching');
    await registrationPage.typeConfirmPassword('not-matching');
    await registrationPage.typeEmail('test@test.com');

    const errorMessage = (await registrationPage.getConfirmPasswordErrorMessage()).trim();

    expect(errorMessage).toBe('Password do not match');
  });

  test('Verify elements on account setup page are correct', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const allElementsAreCorrect = await registrationPage.verifyAccountSetupElements();
    expect(allElementsAreCorrect).toBe(true);
  });

  test('Verify "Create New" tab elements in account setup are correct', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );
    await registrationPage.clickOnCreateNewTab();

    const allTilesArePresent = await registrationPage.verifyAllMnemonicTilesArePresent();
    expect(allTilesArePresent).toBe(true);

    const isCheckBoxVisible = await registrationPage.isUnderstandCheckboxVisible();
    expect(isCheckBoxVisible).toBe(true);

    const isGenerateButtonVisible = await registrationPage.isGenerateButtonVisible();
    expect(isGenerateButtonVisible).toBe(true);
  });

  test('Verify "Import Existing" tab elements in account setup are correct', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const allTilesArePresent = await registrationPage.verifyAllMnemonicTilesArePresent();
    expect(allTilesArePresent).toBe(true);

    const isClearButtonVisible = await registrationPage.isClearButtonVisible();
    expect(isClearButtonVisible).toBe(true);

    const isCheckBoxVisible = await registrationPage.isUnderstandCheckboxVisible();
    expect(isCheckBoxVisible).toBe(false);

    const isGenerateButtonVisible = await registrationPage.isGenerateButtonVisible();
    expect(isGenerateButtonVisible).toBe(false);
  });

  test('Verify re-generate of recovery phrase changes words', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const isTabVisible = await registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await registrationPage.clickOnCreateNewTab();
    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnGenerateButton();

    await registrationPage.captureRecoveryPhraseWords();
    const firstSetOfWords = registrationPage.getCopyOfRecoveryPhraseWords();

    await registrationPage.clickOnGenerateAgainButton();
    await registrationPage.captureRecoveryPhraseWords();
    const secondSetOfWords = registrationPage.getCopyOfRecoveryPhraseWords();

    // Verify that the second set of words is different from the first set
    const wordsAreChanged = registrationPage.compareWordSets(
      Object.values(firstSetOfWords),
      Object.values(secondSetOfWords),
    );
    expect(wordsAreChanged).toBe(true);
  });

  test('Verify generate button is disabled until "I Understand" checkbox is selected', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    await registrationPage.clickOnCreateNewTab();

    const isGenerateButtonClickable = await registrationPage.isGenerateButtonDisabled();
    expect(isGenerateButtonClickable).toBe(true);

    await registrationPage.clickOnUnderstandCheckbox();

    const isGenerateButtonVisibleAfterSelectingCheckbox =
      await registrationPage.isGenerateButtonDisabled();
    expect(isGenerateButtonVisibleAfterSelectingCheckbox).toBe(false);
  });

  test('Verify clear button clears the existing mnemonic phrase', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const isTabVisible = await registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await registrationPage.clickOnCreateNewTab();

    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnGenerateButton();
    await registrationPage.captureRecoveryPhraseWords();

    await registrationPage.clickOnImportTab();

    await registrationPage.fillAllMissingRecoveryPhraseWords();

    await registrationPage.clickOnClearButton();

    const isMnemonicCleared = await registrationPage.verifyAllMnemonicFieldsCleared();

    expect(isMnemonicCleared).toBe(true);
  });

  test('Verify final step of account setup has all correct elements', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const isTabVisible = await registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await registrationPage.clickOnCreateNewTab();
    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnGenerateButton();

    await registrationPage.captureRecoveryPhraseWords();
    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnVerifyButton();

    await registrationPage.fillAllMissingRecoveryPhraseWords();
    await registrationPage.clickOnNextButton();

    const isAllElementsPresent = await registrationPage.verifyFinalStepAccountSetupElements();
    expect(isAllElementsPresent).toBe(true);
  });

  test('Verify successful registration through "Create New" flow', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const isTabVisible = await registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await registrationPage.clickOnCreateNewTab();
    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnGenerateButton();

    await registrationPage.captureRecoveryPhraseWords();
    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnVerifyButton();

    await registrationPage.fillAllMissingRecoveryPhraseWords();
    await registrationPage.clickOnNextButton();

    await registrationPage.clickOnFinalNextButtonWithRetry();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Key Pair saved successfully');
  });

  test('Verify successful registration through "Import Existing" flow', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const isTabVisible = await registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await registrationPage.clickOnCreateNewTab();

    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnGenerateButton();
    await registrationPage.captureRecoveryPhraseWords();

    await registrationPage.clickOnImportTab();

    await registrationPage.fillAllMissingRecoveryPhraseWords();
    await registrationPage.scrollToNextImportButton();
    await registrationPage.clickOnNextImportButton();

    await registrationPage.clickOnFinalNextButtonWithRetry();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Key Pair saved successfully');
  });

  test('Verify user is stored in the database after registration', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    const userExists = await registrationPage.verifyUserExists(globalCredentials.email);
    expect(userExists).toBe(true);
  });

  test('Verify user public key is stored in the database after registration', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.register(
      globalCredentials.email,
      globalCredentials.password,
      globalCredentials.password,
    );

    const isTabVisible = await registrationPage.isCreateNewTabVisible();
    expect(isTabVisible).toBe(true);

    await registrationPage.clickOnCreateNewTab();
    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnGenerateButton();

    await registrationPage.captureRecoveryPhraseWords();
    await registrationPage.clickOnUnderstandCheckbox();
    await registrationPage.clickOnVerifyButton();

    await registrationPage.fillAllMissingRecoveryPhraseWords();
    await registrationPage.clickOnNextButton();

    const publicKeyFromApp = await registrationPage.getPublicKey();

    await registrationPage.clickOnFinalNextButtonWithRetry();

    const publicKeyFromDb = await registrationPage.getPublicKeyByEmail(globalCredentials.email);

    expect(publicKeyFromApp).toBe(publicKeyFromDb);
  });

  test('Verify user private key is stored in the database after registration', async () => {
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    const privateKeyExists = await registrationPage.verifyPrivateKeyExistsByEmail(
      globalCredentials.email,
    );

    expect(privateKeyExists).toBe(true);
  });

  test('Verify user is deleted from the database after resetting account', async () => {
    // BeforeEach executes logout and reset account state, so we just verify it's no longer existing
    await new Promise(resolve => setTimeout(resolve, 500));
    const userExists = await registrationPage.verifyUserExists(globalCredentials.email);
    expect(userExists).toBe(false);
  });

  test('Verify user key pair is deleted from the database after resetting account', async () => {
    // BeforeEach executes logout and reset account state, so we just verify it's no longer existing
    const publicKeyExists = await registrationPage.verifyPublicKeyExistsByEmail(
      globalCredentials.email,
    );
    expect(publicKeyExists).toBe(false);

    const privateKeyExists = await registrationPage.verifyPrivateKeyExistsByEmail(
      globalCredentials.email,
    );
    expect(privateKeyExists).toBe(false);
  });
});
