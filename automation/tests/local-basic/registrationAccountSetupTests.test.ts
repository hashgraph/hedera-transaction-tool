import { expect, test } from '@playwright/test';
import { setupRegistrationSuite } from '../helpers/fixtures/registrationSuite.js';

test.describe('Registration account setup tests @local-basic', () => {
  const suite = setupRegistrationSuite();

  test('Verify elements on account setup page are correct', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.register(
      credentials.email,
      credentials.password,
      credentials.password,
    );

    const allElementsAreCorrect = await suite.registrationPage.verifyAccountSetupElements();
    expect(allElementsAreCorrect).toBe(true);
  });

  test('Verify "Create New" tab elements in account setup are correct', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.register(
      credentials.email,
      credentials.password,
      credentials.password,
    );
    await suite.registrationPage.clickOnCreateNewTab();

    const allTilesArePresent = await suite.registrationPage.verifyAllMnemonicTilesArePresent();
    expect(allTilesArePresent).toBe(true);

    const isCheckBoxVisible = await suite.registrationPage.isUnderstandCheckboxVisible();
    expect(isCheckBoxVisible).toBe(true);

    const isGenerateButtonVisible = await suite.registrationPage.isGenerateButtonVisible();
    expect(isGenerateButtonVisible).toBe(true);
  });

  test('Verify "Import Existing" tab elements in account setup are correct', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.register(
      credentials.email,
      credentials.password,
      credentials.password,
    );

    const allTilesArePresent = await suite.registrationPage.verifyAllMnemonicTilesArePresent();
    expect(allTilesArePresent).toBe(true);

    const isClearButtonVisible = await suite.registrationPage.isClearButtonVisible();
    expect(isClearButtonVisible).toBe(true);

    const isCheckBoxHidden = await suite.registrationPage.isUnderstandCheckboxHidden();
    expect(isCheckBoxHidden).toBe(true);

    const isGenerateButtonHidden = await suite.registrationPage.isGenerateButtonHidden();
    expect(isGenerateButtonHidden).toBe(true);
  });

  test('Verify re-generate of recovery phrase changes words', async () => {
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
    const firstSetOfWords = suite.registrationPage.getCopyOfRecoveryPhraseWords();

    await suite.registrationPage.clickOnGenerateAgainButton();
    await suite.registrationPage.captureRecoveryPhraseWords();
    const secondSetOfWords = suite.registrationPage.getCopyOfRecoveryPhraseWords();

    // Verify that the second set of words is different from the first set
    const wordsAreChanged = suite.registrationPage.compareWordSets(
      Object.values(firstSetOfWords),
      Object.values(secondSetOfWords),
    );
    expect(wordsAreChanged).toBe(true);
  });

  test('Verify generate button is disabled until "I Understand" checkbox is selected', async () => {
    const credentials = suite.createCredentials();

    await suite.registrationPage.register(
      credentials.email,
      credentials.password,
      credentials.password,
    );

    await suite.registrationPage.clickOnCreateNewTab();

    const isGenerateButtonClickable = await suite.registrationPage.isGenerateButtonDisabled();
    expect(isGenerateButtonClickable).toBe(true);

    await suite.registrationPage.clickOnUnderstandCheckbox();

    const isGenerateButtonVisibleAfterSelectingCheckbox =
      await suite.registrationPage.isGenerateButtonDisabled();
    expect(isGenerateButtonVisibleAfterSelectingCheckbox).toBe(false);
  });

  test('Verify clear button clears the existing mnemonic phrase', async () => {
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

    await suite.registrationPage.clickOnClearButton();

    const isMnemonicCleared = await suite.registrationPage.verifyAllMnemonicFieldsCleared();

    expect(isMnemonicCleared).toBe(true);
  });

  test('Verify words are persisted after deleting a single word', async () => {
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

    await suite.registrationPage.clearLastRecoveryPhraseWord();
    await suite.registrationPage.fillLastRecoveryPhraseWord();
    await suite.registrationPage.clickOnNextImportButton();

    expect(await suite.registrationPage.isFinalNextButtonVisible()).toBe(true);
  });

  test('Verify final step of account setup has all correct elements', async () => {
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

    const isAllElementsPresent = await suite.registrationPage.verifyFinalStepAccountSetupElements();
    expect(isAllElementsPresent).toBe(true);
  });
});
