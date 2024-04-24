const { test } = require('@playwright/test');
const {
  setupApp,
  resetAppState,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
} = require('../utils/util');
const RegistrationPage = require('../pages/RegistrationPage.js');
const { expect } = require('playwright/test');
const LoginPage = require('../pages/LoginPage');
const TransactionPage = require('../pages/TransactionPage');

let app, window;
let globalCredentials = { email: '', password: '' };
let registrationPage, loginPage, transactionPage;

test.describe('Transaction tests', () => {
  test.beforeAll(async () => {
    ({ app, window } = await setupApp());
    loginPage = new LoginPage(window);
    transactionPage = new TransactionPage(window);
    await loginPage.logout();
    await resetAppState(window);
    registrationPage = new RegistrationPage(window);

    // Generate credentials and store them globally
    globalCredentials.email = generateRandomEmail();
    globalCredentials.password = generateRandomPassword();

    // Perform registration with the generated credentials
    await registrationPage.completeRegistration(
      globalCredentials.email,
      globalCredentials.password,
    );

    await setupEnvironmentForTransactions(window, globalCredentials.password);
  });

  test.afterAll(async () => {
    await transactionPage.closeCompletedTransaction();
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
    await loginPage.logout();
    await resetAppState(window);

    await closeApp(app);
  });

  test.beforeEach(async () => {
    await transactionPage.closeCompletedTransaction();
    await transactionPage.clickOnTransactionsMenuButton();
    await transactionPage.closeDraftModal();
  });

  test('Verify that all elements on account create page are correct', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const allElementsAreVisible = await transactionPage.verifyAccountCreateTransactionElements();

    expect(allElementsAreVisible).toBe(true);
  });

  test('Verify confirm transaction modal is displayed with valid information for Account Create tx', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    await transactionPage.clickOnSignAndSubmitButton();
    const confirmTransactionIsDisplayedAndCorrect =
      await transactionPage.verifyConfirmTransactionInformation('Account Create Transaction');
    await transactionPage.clickOnCancelTransaction();

    expect(confirmTransactionIsDisplayedAndCorrect).toBe(true);
  });

  test('Verify user can execute create account transaction with single key', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickSignTransactionButton();
    await transactionPage.fillInPassword(globalCredentials.password);
    await transactionPage.clickOnPasswordContinue();

    await transactionPage.waitForSuccessModalToAppear();
    const newAccountId = await transactionPage.getNewAccountIdText();
    await transactionPage.clickOnCloseButtonForCompletedTransaction();
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const createdTimestamp = accountDetails.accounts[0].created_timestamp;
    expect(createdTimestamp).toBeTruthy();
  });

  test('Verify user can create account with memo', async () => {
    await transactionPage.clickOnCreateNewTransactionButton();
    await transactionPage.clickOnCreateAccountTransaction();

    const memoText = 'test memo';
    await transactionPage.fillInMemo(memoText);
    await transactionPage.clickOnSignAndSubmitButton();
    await transactionPage.clickSignTransactionButton();
    await transactionPage.fillInPassword(globalCredentials.password);
    await transactionPage.clickOnPasswordContinue();

    await transactionPage.waitForSuccessModalToAppear();
    const newAccountId = await transactionPage.getNewAccountIdText();
    await transactionPage.clickOnCloseButtonForCompletedTransaction();
    const accountDetails = await transactionPage.mirrorGetAccountResponse(newAccountId);
    const memoFromAPI = accountDetails.accounts[0].memo;
    expect(memoFromAPI).toBe(memoText);
  });
});
