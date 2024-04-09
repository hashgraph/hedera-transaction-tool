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

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage;

//test.describe.configure({ mode: 'parallel' });
test.describe('Registration tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    await resetAppState(window);
    registrationPage = new RegistrationPage(window);
  });

  test.afterAll(async () => {
    await registrationPage.logoutForReset();
    await resetAppState(window);

    // Close the app after the final reset
    await closeApp(app);
  });

  test.beforeEach(async () => {
    await registrationPage.logoutForReset();
    await resetAppState(window);
  });

  //002
  test('Verify elements on registration page', async () => {
    const allElementsAreCorrect = await registrationPage.verifyRegistrationElements();
    expect(allElementsAreCorrect).toBe(true);
  });

  //003
  test('Verify e-mail field - negative', async () => {
    await registrationPage.typeEmail('wrong.gmail');
    await registrationPage.typePassword('test');
    await registrationPage.submitRegistration();

    const errorMessage = (await registrationPage.getEmailErrorMessage()).trim();

    expect(errorMessage).toBe('Invalid e-mail.');
  });

  //004
  test('Verify e-mail field - positive', async () => {
    await registrationPage.typeEmail('test23@test.com');
    await registrationPage.typePassword('test');
    await registrationPage.submitRegistration();

    const isErrorMessageVisible = await registrationPage.isEmailErrorMessageVisible();

    expect(isErrorMessageVisible).toBe(false);
  });

  //005
  test('Verify password field - negative', async () => {
    await registrationPage.typeEmail('test@test.com');
    await registrationPage.typePassword('test');
    await registrationPage.submitRegistration();

    const errorMessage = (await registrationPage.getPasswordErrorMessage()).trim();

    expect(errorMessage).toBe('Invalid password.');
  });

  test('Verify confirm password field - negative', async () => {
    await registrationPage.typeEmail('test@test.com');
    await registrationPage.typePassword('test');
    await registrationPage.typeConfirmPassword('notTest');

    await registrationPage.submitRegistration();

    const errorMessage = (await registrationPage.getConfirmPasswordErrorMessage()).trim();

    expect(errorMessage).toBe('Password do not match.');
  });

  //017
  test('Verify elements on account setup page', async () => {
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

  //018
  test('Verify account setup create new tab elements', async () => {
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

  //019
  test('Verify account setup import existing tab elements', async () => {
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

  //021
  test('Verify re-generate recovery phrase and verify words are changed', async () => {
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

  //022
  test('Verify generate button is not clickable until you select the understand checkbox', async () => {
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

  //028
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

  //025
  test('Verify account setup final step elements', async () => {
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

  //020, 023, 024
  test('User can register successfully -> create new flow', async () => {
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

  //027
  test('User can register successfully -> import existing flow', async () => {
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
});
