const { test } = require('@playwright/test');
const {
  setupApp,
  resetAppState,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
} = require('../utils/util');
const { getPrivateKey, generateEd25519KeyPair } = require('../utils/keyUtil');
const RegistrationPage = require('../pages/RegistrationPage.js');
const { expect } = require('playwright/test');
const LoginPage = require('../pages/LoginPage');
const SettingsPage = require('../pages/SettingsPage');
const TransactionPage = require('../pages/TransactionPage');
const { resetDbState } = require('../utils/databaseUtil');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, settingsPage, transactionPage;

test.describe('Settings tests', () => {
  test.beforeAll(async () => {
    await resetDbState();
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    registrationPage = new RegistrationPage(window);
    settingsPage = new SettingsPage(window);
    transactionPage = new TransactionPage(window);

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
    await closeApp(app);
    await resetDbState();
  });

  test.beforeEach(async () => {
    await loginPage.logout();
    await loginPage.login(globalCredentials.email, globalCredentials.password);
    await settingsPage.clickOnSettingsButton();
  });

  test('Verify that all elements in settings page are present', async () => {
    const allElementsVisible = await settingsPage.verifySettingsElements();
    expect(allElementsVisible).toBe(true);
  });

  test('Verify user can decrypt private key', async () => {
    await settingsPage.clickOnKeysTab();

    await settingsPage.clickOnEyeDecryptIcon();
    const decryptedPrivateKey = await settingsPage.getPrivateKeyText();

    expect(decryptedPrivateKey).toBeTruthy();
  });

  test('Verify user can restore key', async () => {
    await settingsPage.clickOnKeysTab();

    await settingsPage.clickOnRestoreButton();
    await settingsPage.clickOnContinueButton();

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
    expect(toastMessage).toBe('Key pair saved');

    // key pair was successfully restored, so we increment the index
    await settingsPage.incrementIndex();
  });

  test('Verify user can delete key', async () => {
    await settingsPage.clickOnKeysTab();

    const rowCountBeforeRestore = await settingsPage.getKeyRowCount();

    await settingsPage.clickOnRestoreButton();
    await settingsPage.clickOnContinueButton();

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

    // key pair was successfully restored, so we increment the index
    await settingsPage.incrementIndex();

    // deleting the key pair
    await settingsPage.clickOnDeleteButtonAtIndex(rowCountBeforeRestore.toString());
    await settingsPage.clickOnDeleteKeyPairButton();

    // going back and forth as delete is quick, and it does not pick the change
    await loginPage.waitForToastToDisappear();

    const rowCountAfterDelete = await settingsPage.getKeyRowCount();

    // verifying that key pair before the recovery is the same after the deletion
    expect(rowCountBeforeRestore).toBe(rowCountAfterDelete);

    // key pair was successfully deleted, so we decrease the index
    await settingsPage.decrementIndex();
  });

  test('Verify user restored key pair is saved in the local database', async () => {
    await settingsPage.clickOnKeysTab();

    await settingsPage.clickOnRestoreButton();
    await settingsPage.clickOnContinueButton();

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

    // key pair was successfully restored, so we increment the index
    await settingsPage.incrementIndex();
  });

  test('Verify user can import ECDSA key', async () => {
    await settingsPage.clickOnKeysTab();

    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnECDSADropDown();

    const privateKey = getPrivateKey();

    await settingsPage.fillInECDSAPrivateKey(privateKey);
    await settingsPage.fillInECDSANickname('Test-ECDSA-Import');
    // await settingsPage.fillInECDSAPassword(globalCredentials.password);
    await loginPage.waitForToastToDisappear();
    await settingsPage.clickOnECDSAImportButton();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('ECDSA private key imported successfully');

    const rowCount = await settingsPage.getKeyRowCount();
    const lastRowIndex = rowCount - 1;

    const { index, nickname, accountID, keyType, publicKey } =
      await settingsPage.getRowDataByIndex(lastRowIndex);
    expect(index).toBe('N/A');
    expect(nickname.trim()).toBe('Test-ECDSA-Import');
    expect(accountID).toBeTruthy();
    expect(keyType).toBe('ECDSA');
    expect(publicKey).toBeTruthy();
  });

  test('Verify user can import ED25519 keys', async () => {
    await settingsPage.clickOnKeysTab();

    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();

    const privateKey = generateEd25519KeyPair();

    await settingsPage.fillInED25519PrivateKey(privateKey);
    await settingsPage.fillInED25519Nickname('Test-ED25519-Import');
    await loginPage.waitForToastToDisappear();
    await settingsPage.clickOnED25519ImportButton();

    const toastMessage = await registrationPage.getToastMessage();
    expect(toastMessage).toBe('ED25519 private key imported successfully');

    const rowCount = await settingsPage.getKeyRowCount();
    const lastRowIndex = rowCount - 1;

    const { index, nickname, accountID, keyType, publicKey } =
      await settingsPage.getRowDataByIndex(lastRowIndex);
    expect(index).toBe('N/A');
    expect(nickname.trim()).toBe('Test-ED25519-Import');
    expect(accountID).toBeTruthy();
    expect(keyType).toBe('ED25519');
    expect(publicKey).toBeTruthy();
  });

  test('Verify user can change password', async () => {
    await settingsPage.clickOnProfileTab();

    await settingsPage.fillInCurrentPassword(globalCredentials.password);
    const newPassword = generateRandomPassword();
    await settingsPage.fillInNewPassword(newPassword);
    await settingsPage.clickOnChangePasswordButton();
    await settingsPage.clickOnConfirmChangePassword();
    await settingsPage.clickOnCloseButton();
    globalCredentials.password = newPassword;
    await loginPage.logout();

    // verify that the settings button is visible(indicating he's logged in successfully in the app)
    await loginPage.login(globalCredentials.email, globalCredentials.password);
    const isButtonVisible = await loginPage.isSettingsButtonVisible();

    expect(isButtonVisible).toBe(true);
  });

  test('Verify user can change key nickname', async () => {
    const newNickname = 'testChangeNickname';
    await settingsPage.clickOnKeysTab();
    await settingsPage.changeNicknameForFirstKey(newNickname);
    const keyData = await settingsPage.getRowDataByIndex(0);
    expect(keyData.nickname.trim()).toBe(newNickname);
  });

  test('Verify user can set global max tx fee', async () => {
    const maxTransactionFee = '5';
    await settingsPage.fillInDefaultMaxTransactionFee(maxTransactionFee);

    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const transactionFee = await transactionPage.getMaxTransactionFee();

    expect(transactionFee).toBe(maxTransactionFee);
  });
});
