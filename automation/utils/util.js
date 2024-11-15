const { expect } = require('@playwright/test');
const { launchHederaTransactionTool } = require('./electronAppLauncher');
const { migrationDataExists } = require('./oldTool.js');
const LoginPage = require('../pages/LoginPage.js');
const SettingsPage = require('../pages/SettingsPage');
const fs = require('fs').promises;
const path = require('path');
const _ = require('lodash');
const Diff = require('deep-diff');

async function setupApp() {
  console.log(asciiArt); // Display ASCII art as the app starts
  const app = await launchHederaTransactionTool();
  const window = await app.firstWindow();
  const loginPage = new LoginPage(window);

  await window.evaluate(() => {
    window.localStorage.clear();
    // window.localStorage.setItem('important-note-accepted', 'true');
  });

  expect(window).not.toBeNull();
  await loginPage.closeImportantNoteModal();
  const canMigrate = migrationDataExists(app);
  if (canMigrate) {
    await loginPage.closeMigrationModal();
  }
  if (process.platform === 'darwin') {
    await loginPage.closeKeyChainModal();
  }

  return { app, window };
}

async function resetAppState(window, app) {
  const loginPage = new LoginPage(window);
  await loginPage.resetState();
  const canMigrate = migrationDataExists(app);
  if (canMigrate) {
    await loginPage.closeMigrationModal();
  }
  if (process.platform === 'darwin') {
    await loginPage.closeKeyChainModal();
  }
}

async function closeApp(app) {
  await app.close();
}

async function setupEnvironmentForTransactions(window, privateKey = process.env.PRIVATE_KEY) {
  if (process.env.ENVIRONMENT.toUpperCase() === 'LOCALNET') {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnLocalNodeTab();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(privateKey);
    await settingsPage.fillInED25519Nickname('Payer Account');
    await settingsPage.clickOnED25519ImportButton();
  } else {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnECDSADropDown();
    await settingsPage.fillInECDSAPrivateKey(privateKey);
    await settingsPage.fillInECDSANickname('Payer Account');
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

function calculateTimeout(totalUsers, timePerUser) {
  return totalUsers * timePerUser * 2000;
}

/**
 * Waits for a valid start time to continue the test.
 * @param dateTimeString - The target date and time in string format.
 * @param bufferSeconds - The buffer time in seconds to wait before the target time.
 * @returns {Promise<void>} - A promise that resolves after the wait time.
 */
async function waitForValidStart(dateTimeString, bufferSeconds = 15) {
  // Convert the dateTimeString to a Date object
  const targetDate = new Date(dateTimeString);

  // Get the current time
  const currentDate = new Date();

  // Calculate the difference in milliseconds
  const timeDifference = targetDate - currentDate;

  // Add buffer time (in milliseconds)
  const waitTime = Math.max(timeDifference + bufferSeconds * 1000, 0); // Ensure non-negative

  // Wait for the calculated time
  if (waitTime > 0) {
    console.log(`Waiting for ${waitTime / 1000} seconds until the valid start time...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  } else {
    console.log('The target time has already passed.');
  }
}

/**
 * Asynchronously deletes all .bin files in the specified directory.
 * @param {string} directory - The path to the directory where .bin files will be deleted.
 */
async function cleanupBinFiles(directory) {
  try {
    const files = await fs.readdir(directory);
    const deletePromises = files.map(async file => {
      const filePath = path.join(directory, file);
      const fileStat = await fs.stat(filePath);

      if (fileStat.isFile() && path.extname(file) === '.bin') {
        try {
          await fs.unlink(filePath);
          console.log(`Deleted file: ${filePath}`);
        } catch (err) {
          console.error(`Failed to delete file ${filePath}: ${err.message}`);
        }
      }
    });
    await Promise.all(deletePromises);
    console.log('Cleanup completed.');
  } catch (err) {
    console.error(`Unable to read directory ${directory}: ${err.message}`);
  }
}

/**
 * Compares two JSON data structures and reports differences.
 * @param {object} jsonData1 - The first JSON data object.
 * @param {object} jsonData2 - The second JSON data object.
 * @param {string[]} [keysToIgnore] - Optional array of keys to ignore during comparison.
 * @returns {object|null} - Returns null if objects are equal, or an array of differences.
 */
function compareJsonFiles(jsonData1, jsonData2, keysToIgnore = []) {
  // Remove keys to ignore from both JSON objects
  const jsonData1Cleaned = removeKeys(jsonData1, keysToIgnore);
  const jsonData2Cleaned = removeKeys(jsonData2, keysToIgnore);

  // Use lodash to check for deep equality
  const isEqual = _.isEqual(jsonData1Cleaned, jsonData2Cleaned);

  if (isEqual) {
    return null;
  } else {
    // Use deep-diff to find differences
    return Diff.diff(jsonData1Cleaned, jsonData2Cleaned);
  }
}

/**
 * Recursively removes specified keys from the JSON object.
 * @param {object} obj - The JSON object.
 * @param {string[]} keysToRemove - Array of keys to remove.
 * @returns {object} - The cleaned JSON object.
 */
function removeKeys(obj, keysToRemove) {
  if (_.isArray(obj)) {
    return obj.map(item => removeKeys(item, keysToRemove));
  } else if (_.isObject(obj) && obj !== null) {
    return Object.keys(obj).reduce((acc, key) => {
      if (!keysToRemove.includes(key)) {
        acc[key] = removeKeys(obj[key], keysToRemove);
      }
      return acc;
    }, {});
  } else {
    return obj;
  }
}

/**
 * Parses the content of a properties file into an object.
 * @param {string} content - The content of the properties file.
 * @returns {object} - The parsed key-value pairs as an object.
 */
function parsePropertiesContent(content) {
  const lines = content.split('\n');
  const obj = {};

  lines.forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const index = line.indexOf('=');
      if (index > -1) {
        const key = line.substring(0, index).trim();
        obj[key] = line.substring(index + 1).trim();
      }
    }
  });

  return obj;
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
  calculateTimeout,
  waitForValidStart,
  cleanupBinFiles,
  compareJsonFiles,
  parsePropertiesContent,
};
