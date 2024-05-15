const { expect } = require('@playwright/test');
const { launchHederaTransactionTool } = require('./electronAppLauncher');
const LoginPage = require('../pages/LoginPage.js');
const SettingsPage = require('../pages/SettingsPage');

async function setupApp() {
  console.log(asciiArt); // Display ASCII art as the app starts
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

/**
 * Formats the transaction ID from one format to another.
 * Converts from: 0.0.1509@1715260863.080000000
 * To: 0.0.1509-1715260863-080000000
 * Specifically converts '@' to '-' and only the first dot after the '@' to '-' without affecting initial '0.0'.
 * @param {string} transactionId - The transaction ID in the original format.
 * @returns {string} The formatted transaction ID.
 */
function formatTransactionId(transactionId) {
  // Replace '@' with '-'
  let formattedId = transactionId.replace('@', '-');

  // Regex to find the first dot after a sequence of digits that follows the '-' replacing '@'
  // This regex specifically avoids changing any dots before the '-'
  formattedId = formattedId.replace(/-(\d+)\.(\d+)/, '-$1-$2');

  return formattedId;
}

/**
 * Utility function to pause execution for a given duration.
 * @param {number} ms - The number of milliseconds to delay.
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const asciiArt =
  '\n' +
  ' ________ __    __        ________ ______   ______  __               ______  __    __ ________ ______  __       __  ______  ________ ______  ______  __    __ \n' +
  '/        /  |  /  |      /        /      \\ /      \\/  |             /      \\/  |  /  /        /      \\/  \\     /  |/      \\/        /      |/      \\/  \\  /  |\n' +
  '$$$$$$$$/$$ |  $$ |      $$$$$$$$/$$$$$$  /$$$$$$  $$ |            /$$$$$$  $$ |  $$ $$$$$$$$/$$$$$$  $$  \\   /$$ /$$$$$$  $$$$$$$$/$$$$$$//$$$$$$  $$  \\ $$ |\n' +
  '   $$ |  $$  \\/$$/          $$ | $$ |  $$ $$ |  $$ $$ |            $$ |__$$ $$ |  $$ |  $$ | $$ |  $$ $$$  \\ /$$$ $$ |__$$ |  $$ |    $$ | $$ |  $$ $$$  \\$$ |\n' +
  '   $$ |   $$  $$<           $$ | $$ |  $$ $$ |  $$ $$ |            $$    $$ $$ |  $$ |  $$ | $$ |  $$ $$$$  /$$$$ $$    $$ |  $$ |    $$ | $$ |  $$ $$$$  $$ |\n' +
  '   $$ |    $$$$  \\          $$ | $$ |  $$ $$ |  $$ $$ |            $$$$$$$$ $$ |  $$ |  $$ | $$ |  $$ $$ $$ $$/$$ $$$$$$$$ |  $$ |    $$ | $$ |  $$ $$ $$ $$ |\n' +
  '   $$ |   $$ /$$  |         $$ | $$ \\__$$ $$ \\__$$ $$ |_____       $$ |  $$ $$ \\__$$ |  $$ | $$ \\__$$ $$ |$$$/ $$ $$ |  $$ |  $$ |   _$$ |_$$ \\__$$ $$ |$$$$ |\n' +
  '   $$ |  $$ |  $$ |         $$ | $$    $$/$$    $$/$$       |      $$ |  $$ $$    $$/   $$ | $$    $$/$$ | $/  $$ $$ |  $$ |  $$ |  / $$   $$    $$/$$ | $$$ |\n' +
  '   $$/   $$/   $$/          $$/   $$$$$$/  $$$$$$/ $$$$$$$$/       $$/   $$/ $$$$$$/    $$/   $$$$$$/ $$/      $$/$$/   $$/   $$/   $$$$$$/ $$$$$$/ $$/   $$/ \n';

module.exports = {
  setupApp,
  resetAppState,
  closeApp,
  generateRandomEmail,
  generateRandomPassword,
  setupEnvironmentForTransactions,
  formatTransactionId,
  delay,
};
