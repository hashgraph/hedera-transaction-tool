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
const LoginPage = require('../pages/LoginPage');
const SettingsPage = require('../pages/SettingsPage');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, settingsPage;

test.describe('Settings tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    await loginPage.logout();
    await resetAppState(window);
    registrationPage = new RegistrationPage(window);
    settingsPage = new SettingsPage(window);

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );
  });

  test.afterAll(async () => {
    await loginPage.logout();
    await resetAppState(window);

    await closeApp(app);
  });

  test.beforeEach(async () => {
    await loginPage.logout();
    await loginPage.login(globalCredentials.email, globalCredentials.password);
  });

  test('Verify that all elements in settings page are present', async () => {
    await settingsPage.clickOnSettingsButton();
    const allElementsVisible = await settingsPage.verifySettingsElements();
    expect(allElementsVisible).toBe(true);
  });

  test('Verify that all elements on Custom tab are visible and correct', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnCustomTab();

    const consensusNodeEndpoint = await settingsPage.getConsensusNodeEndpointText();
    expect(consensusNodeEndpoint).toBe('127.0.0.1:50211');

    const mirrorNodeGrpcEndpoint = await settingsPage.getMirrorNodeGrpcEndpointText();
    expect(mirrorNodeGrpcEndpoint).toBe('127.0.0.1:5600');

    const mirrorNodeRestEndpoint = await settingsPage.getMirrorNodeRestEndpointText();
    expect(mirrorNodeRestEndpoint).toBe('http://localhost:5551/api/v1');

    const nodeAccountId = await settingsPage.getNodeAccountIdInputText();
    expect(nodeAccountId).toBe('0.0.3');

    const isSetButtonVisible = await settingsPage.isSetButtonVisible();
    expect(isSetButtonVisible).toBe(true);
  });

  test('Verify user can restore key', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();

    await settingsPage.clickOnRestoreButton();
    await settingsPage.clickOnContinueButton();

    await settingsPage.fillInPassword(globalCredentials.password);
    await settingsPage.clickOnPasswordContinueButton();

    const isMnemonicRequired = settingsPage.isElementVisible(
      registrationPage.getRecoveryWordSelector(1),
    );
    if (isMnemonicRequired) {
      await registrationPage.fillAllMissingRecoveryPhraseWords();
      await settingsPage.clickOnContinuePhraseButton();
    }

    await settingsPage.fillInIndex(settingsPage.currentIndex);
    await settingsPage.clickOnIndexContinueButton();

    await loginPage.waitForToastToDisappear();
    await settingsPage.fillInNickname('testNickname' + settingsPage.currentIndex);
    await settingsPage.clickOnNicknameContinueButton();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('Key Pair saved');
  });

  test('Verify user rested key pair is saved in the local database', async () => {
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();

    await settingsPage.clickOnRestoreButton();
    await settingsPage.clickOnContinueButton();

    await settingsPage.fillInPassword(globalCredentials.password);
    await settingsPage.clickOnPasswordContinueButton();

    const isMnemonicRequired = settingsPage.isElementVisible(
      registrationPage.getRecoveryWordSelector(1),
    );
    if (isMnemonicRequired) {
      await registrationPage.fillAllMissingRecoveryPhraseWords();
      await settingsPage.clickOnContinuePhraseButton();
    }
    const currentIndex = settingsPage.currentIndex;
    await settingsPage.fillInIndex(settingsPage.currentIndex);
    await settingsPage.clickOnIndexContinueButton();

    await settingsPage.fillInNickname('testNickname' + settingsPage.currentIndex);
    await settingsPage.clickOnNicknameContinueButton();

    const isKeyPairSavedInDatabase = await settingsPage.verifyKeysExistByIndexAndEmail(
      globalCredentials.email,
      currentIndex,
    );
    expect(isKeyPairSavedInDatabase).toBe(true);
  });
});
