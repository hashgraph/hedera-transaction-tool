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
import { allure } from 'allure-playwright';

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage;

test.describe('Registration tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    registrationPage = new RegistrationPage(window);
    await registrationPage.logoutForReset();
    await resetAppState(window);
  });

  test.afterAll(async () => {
    await registrationPage.logoutForReset();
    await resetAppState(window);

    await closeApp(app);
  });

  test.beforeEach(async () => {
    await registrationPage.logoutForReset();
    await resetAppState(window);
  });

  test('Verify all elements are present on the registration page', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Verify all registration page elements are present', async () => {
      const allElementsAreCorrect = await registrationPage.verifyRegistrationElements();
      expect(allElementsAreCorrect).toBe(true);
    });
  });

  test('Verify rejection of invalid email format in the registration form', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'minor');

    await allure.step('Type invalid email', async () => {
      await registrationPage.typeEmail('wrong.gmail');
    });
    await allure.step('Type password', async () => {
      await registrationPage.typePassword('test');
    });
    await allure.step('Submit registration form', async () => {
      await registrationPage.submitRegistration();
    });
    await allure.step('Verify the email error message', async () => {
      const errorMessage = (await registrationPage.getEmailErrorMessage()).trim();
      expect(errorMessage).toBe('Invalid e-mail.');
    });
  });

  test('Verify e-mail field accepts valid format', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Type valid email', async () => {
      await registrationPage.typeEmail('test23@test.com');
    });
    await allure.step('Type password', async () => {
      await registrationPage.typePassword('test');
    });
    await allure.step('Submit registration form', async () => {
      await registrationPage.submitRegistration();
    });
    await allure.step('Verify no error message for email', async () => {
      const isErrorMessageVisible = await registrationPage.isEmailErrorMessageVisible();
      expect(isErrorMessageVisible).toBe(false);
    });
  });

  test('Verify password field rejects empty password', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'minor');

    await allure.step('Type valid email', async () => {
      await registrationPage.typeEmail('test@test.com');
    });
    await allure.step('Type password and leave confirm password empty', async () => {
      await registrationPage.typePassword('test');
    });
    await allure.step('Submit registration form', async () => {
      await registrationPage.submitRegistration();
    });
    await allure.step('Verify the password error message', async () => {
      const errorMessage = (await registrationPage.getPasswordErrorMessage()).trim();
      expect(errorMessage).toBe('Invalid password.');
    });
  });

  test('Verify confirm password field rejects mismatching passwords', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Type valid email', async () => {
      await registrationPage.typeEmail('test@test.com');
    });
    await allure.step('Type password', async () => {
      await registrationPage.typePassword('test');
    });
    await allure.step('Type mismatching confirm password', async () => {
      await registrationPage.typeConfirmPassword('notTest');
    });
    await allure.step('Submit registration form', async () => {
      await registrationPage.submitRegistration();
    });
    await allure.step('Verify the confirm password error message', async () => {
      const errorMessage = (await registrationPage.getConfirmPasswordErrorMessage()).trim();
      expect(errorMessage).toBe('Password do not match.');
    });
  });

  test('Verify elements on account setup page are correct', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Verify account setup elements', async () => {
      const allElementsAreCorrect = await registrationPage.verifyAccountSetupElements();
      expect(allElementsAreCorrect).toBe(true);
    });
  });

  test('Verify "Create New" tab elements in account setup are correct', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Create New" tab', async () => {
      await registrationPage.clickOnCreateNewTab();
    });
    await allure.step('Verify mnemonic tiles are present', async () => {
      const allTilesArePresent = await registrationPage.verifyAllMnemonicTilesArePresent();
      expect(allTilesArePresent).toBe(true);
    });
    await allure.step('Verify "I Understand" checkbox is visible', async () => {
      const isCheckBoxVisible = await registrationPage.isUnderstandCheckboxVisible();
      expect(isCheckBoxVisible).toBe(true);
    });
    await allure.step('Verify generate button is visible', async () => {
      const isGenerateButtonVisible = await registrationPage.isGenerateButtonVisible();
      expect(isGenerateButtonVisible).toBe(true);
    });
  });

  test('Verify "Import Existing" tab elements in account setup are correct', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Import Existing" tab', async () => {
      await registrationPage.clickOnImportTab();
    });
    await allure.step('Verify mnemonic tiles are present', async () => {
      const allTilesArePresent = await registrationPage.verifyAllMnemonicTilesArePresent();
      expect(allTilesArePresent).toBe(true);
    });
    await allure.step('Verify clear button is visible', async () => {
      const isClearButtonVisible = await registrationPage.isClearButtonVisible();
      expect(isClearButtonVisible).toBe(true);
    });
    await allure.step('Verify "I Understand" checkbox is not visible', async () => {
      const isCheckBoxVisible = await registrationPage.isUnderstandCheckboxVisible();
      expect(isCheckBoxVisible).toBe(false);
    });
    await allure.step('Verify generate button is not visible', async () => {
      const isGenerateButtonVisible = await registrationPage.isGenerateButtonVisible();
      expect(isGenerateButtonVisible).toBe(false);
    });
  });

  test('Verify re-generate of recovery phrase changes words', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');
    let firstSetOfWords, secondSetOfWords;

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Create New" tab', async () => {
      const isTabVisible = await registrationPage.isCreateNewTabVisible();
      expect(isTabVisible).toBe(true);
      await registrationPage.clickOnCreateNewTab();
    });
    await allure.step('Click on "I Understand" checkbox and generate button', async () => {
      await registrationPage.clickOnUnderstandCheckbox();
      await registrationPage.clickOnGenerateButton();
    });
    await allure.step('Capture first set of recovery phrase words', async () => {
      await registrationPage.captureRecoveryPhraseWords();
      firstSetOfWords = registrationPage.getCopyOfRecoveryPhraseWords();
    });
    await allure.step(
      'Click on generate again button and capture second set of words',
      async () => {
        await registrationPage.clickOnGenerateAgainButton();
        await registrationPage.captureRecoveryPhraseWords();
        secondSetOfWords = registrationPage.getCopyOfRecoveryPhraseWords();
      },
    );
    await allure.step(
      'Verify that the second set of words is different from the first set',
      async () => {
        const wordsAreChanged = registrationPage.compareWordSets(
          Object.values(firstSetOfWords),
          Object.values(secondSetOfWords),
        );
        expect(wordsAreChanged).toBe(true);
      },
    );
  });

  test('Verify generate button is disabled until "I Understand" checkbox is selected', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Create New" tab', async () => {
      await registrationPage.clickOnCreateNewTab();
    });
    await allure.step('Verify generate button is disabled', async () => {
      const isGenerateButtonClickable = await registrationPage.isGenerateButtonDisabled();
      expect(isGenerateButtonClickable).toBe(true);
    });
    await allure.step('Click on "I Understand" checkbox', async () => {
      await registrationPage.clickOnUnderstandCheckbox();
    });
    await allure.step('Verify generate button is enabled', async () => {
      const isGenerateButtonVisibleAfterSelectingCheckbox =
        await registrationPage.isGenerateButtonDisabled();
      expect(isGenerateButtonVisibleAfterSelectingCheckbox).toBe(false);
    });
  });

  test('Verify clear button clears the existing mnemonic phrase', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Create New" tab', async () => {
      const isTabVisible = await registrationPage.isCreateNewTabVisible();
      expect(isTabVisible).toBe(true);
      await registrationPage.clickOnCreateNewTab();
    });
    await allure.step('Click on "I Understand" checkbox and generate button', async () => {
      await registrationPage.clickOnUnderstandCheckbox();
      await registrationPage.clickOnGenerateButton();
      await registrationPage.captureRecoveryPhraseWords();
    });
    await allure.step('Click on "Import" tab and fill recovery phrase words', async () => {
      await registrationPage.clickOnImportTab();
      await registrationPage.fillAllMissingRecoveryPhraseWords();
    });
    await allure.step('Click on clear button and verify mnemonic fields are cleared', async () => {
      await registrationPage.clickOnClearButton();
      const isMnemonicCleared = await registrationPage.verifyAllMnemonicFieldsCleared();
      expect(isMnemonicCleared).toBe(true);
    });
  });

  test('Verify final step of account setup has all correct elements', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'normal');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Create New" tab', async () => {
      const isTabVisible = await registrationPage.isCreateNewTabVisible();
      expect(isTabVisible).toBe(true);
      await registrationPage.clickOnCreateNewTab();
    });
    await allure.step('Click on "I Understand" checkbox and generate button', async () => {
      await registrationPage.clickOnUnderstandCheckbox();
      await registrationPage.clickOnGenerateButton();
      await registrationPage.captureRecoveryPhraseWords();
      await registrationPage.clickOnUnderstandCheckbox();
      await registrationPage.clickOnVerifyButton();
      await registrationPage.fillAllMissingRecoveryPhraseWords();
      await registrationPage.clickOnNextButton();
    });
    await allure.step('Verify final step elements', async () => {
      const isAllElementsPresent = await registrationPage.verifyFinalStepAccountSetupElements();
      expect(isAllElementsPresent).toBe(true);
    });
  });

  test('Verify successful registration through "Create New" fminor', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'critical');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Create New" tab', async () => {
      const isTabVisible = await registrationPage.isCreateNewTabVisible();
      expect(isTabVisible).toBe(true);
      await registrationPage.clickOnCreateNewTab();
    });
    await allure.step('Click on "I Understand" checkbox and generate button', async () => {
      await registrationPage.clickOnUnderstandCheckbox();
      await registrationPage.clickOnGenerateButton();
      await registrationPage.captureRecoveryPhraseWords();
      await registrationPage.clickOnUnderstandCheckbox();
      await registrationPage.clickOnVerifyButton();
      await registrationPage.fillAllMissingRecoveryPhraseWords();
      await registrationPage.clickOnNextButton();
      await registrationPage.clickOnFinalNextButtonWithRetry();
    });
    await allure.step('Verify toast message', async () => {
      const toastMessage = await registrationPage.getToastMessage();
      expect(toastMessage).toBe('Key Pair saved successfully');
    });
  });

  test('Verify successful registration through "Import Existing" fminor', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'critical');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register with generated credentials', async () => {
      await registrationPage.register(
        globalCredentials.email,
        globalCredentials.password,
        globalCredentials.password,
      );
    });
    await allure.step('Click on "Create New" tab', async () => {
      const isTabVisible = await registrationPage.isCreateNewTabVisible();
      expect(isTabVisible).toBe(true);
      await registrationPage.clickOnCreateNewTab();
    });
    await allure.step('Click on "I Understand" checkbox and generate button', async () => {
      await registrationPage.clickOnUnderstandCheckbox();
      await registrationPage.clickOnGenerateButton();
      await registrationPage.captureRecoveryPhraseWords();
      await registrationPage.clickOnImportTab();
      await registrationPage.fillAllMissingRecoveryPhraseWords();
      await registrationPage.scrollToNextImportButton();
      await registrationPage.clickOnNextImportButton();
      await registrationPage.clickOnFinalNextButtonWithRetry();
    });
    await allure.step('Verify toast message', async () => {
      const toastMessage = await registrationPage.getToastMessage();
      expect(toastMessage).toBe('Key Pair saved successfully');
    });
  });

  test('Verify user is stored in the database after registration', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'critical');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Complete registration', async () => {
      await registrationPage.completeRegistration(
        globalCredentials.email,
        globalCredentials.password,
      );
    });
    await allure.step('Verify user exists in the database', async () => {
      const userExists = await registrationPage.verifyUserExists(globalCredentials.email);
      expect(userExists).toBe(true);
    });
  });

  test('Verify user public key is stored in the database after registration', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'critical');
    let publicKeyFromApp;
    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Register and capture public key', async () => {
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
      publicKeyFromApp = await registrationPage.getPublicKey();
      await registrationPage.clickOnFinalNextButtonWithRetry();
    });
    await allure.step('Verify public key in database', async () => {
      const publicKeyFromDb = await registrationPage.getPublicKeyByEmail(globalCredentials.email);
      expect(publicKeyFromApp).toBe(publicKeyFromDb);
    });
  });

  test('Verify user private key is stored in the database after registration', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'critical');

    await allure.step('Generate random email and password', async () => {
      globalCredentials.email = generateRandomEmail();
      globalCredentials.password = generateRandomPassword();
    });
    await allure.step('Complete registration', async () => {
      await registrationPage.completeRegistration(
        globalCredentials.email,
        globalCredentials.password,
      );
    });
    await allure.step('Verify private key exists in database', async () => {
      const privateKeyExists = await registrationPage.verifyPrivateKeyExistsByEmail(
        globalCredentials.email,
      );
      expect(privateKeyExists).toBe(true);
    });
  });

  test('Verify user is deleted from the database after resetting account', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'critical');

    await allure.step('Verify user no longer exists after reset', async () => {
      // BeforeEach executes logout and reset account state, so we just verify it's no longer existing
      const userExists = await registrationPage.verifyUserExists(globalCredentials.email);
      expect(userExists).toBe(false);
    });
  });

  test('Verify user key pair is deleted from the database after resetting account', async () => {
    await allure.label('feature', 'Registration');
    await allure.label('severity', 'critical');

    await allure.step('Verify public key no longer exists after reset', async () => {
      // BeforeEach executes logout and reset account state, so we just verify it's no longer existing
      const publicKeyExists = await registrationPage.verifyPublicKeyExistsByEmail(
        globalCredentials.email,
      );
      expect(publicKeyExists).toBe(false);
    });
    await allure.step('Verify private key no longer exists after reset', async () => {
      const privateKeyExists = await registrationPage.verifyPrivateKeyExistsByEmail(
        globalCredentials.email,
      );
      expect(privateKeyExists).toBe(false);
    });
  });
});
