const { expect } = require('@playwright/test');
const { launchHederaTransactionTool } = require('./electronAppLauncher');
const LoginPage = require('../pages/LoginPage.js');
const SettingsPage = require('../pages/SettingsPage');

async function setupApp() {
  const app = await launchHederaTransactionTool();
  const window = await app.firstWindow();
  const loginPage = new LoginPage(window);
  expect(window).not.toBeNull();
  await loginPage.closeImportantNoteModal();
  return { app, window };
}

async function resetAppState(window) {
  const loginPage = new LoginPage(window);
  await loginPage.resetState();
}

async function closeApp(app) {
  await app.close();
}

async function setupEnvironmentForTransactions(window, password) {
  if (process.env.ENVIRONMENT.toUpperCase() === 'LOCALNET') {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnCustomTab();
    await settingsPage.clickOnSetButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(process.env.PRIVATE_KEY);
    await settingsPage.fillInED25519Nickname('Payer Account');
    await settingsPage.fillInED25519Password(password);
    await settingsPage.clickOnED25519ImportButton();
  } else {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnECDSADropDown();
    await settingsPage.fillInECDSAPrivateKey(process.env.PRIVATE_KEY);
    await settingsPage.fillInECDSANickname('Payer Account');
    await settingsPage.fillInECDSAPassword(password);
    await settingsPage.clickOnECDSAImportButton();
  }
}

const generateRandomEmail = (domain = 'test.com') => {
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${randomPart}@${domain}`;
};

const generateRandomPassword = (length = 10) => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

module.exports = {
  setupApp,
  resetAppState,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
};
