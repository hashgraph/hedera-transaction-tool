import { ElectronApplication, expect, Page } from '@playwright/test';
import { launchHederaTransactionTool } from './electronAppLauncher.js';
import { migrationDataExists } from './oldTools.js';
import { LoginPage } from '../pages/LoginPage.js';
import { SettingsPage } from '../pages/SettingsPage.js';
import * as fsp from 'fs/promises';
import _ from 'lodash';
import Diff from 'deep-diff';
import { OrganizationPage } from '../pages/OrganizationPage.js';
import { TransactionPage } from '../pages/TransactionPage.js';
import { generateEd25519KeyPair } from './keyUtil.js';

/**
 * Localnet payer account ID corresponding to the PRIVATE_KEY in .env
 * Solo account 0.0.1022 with key: 44162cd9b9a2f5582bd13b43cfd8be3bc20b8a81ee77f6bf77391598bcfbae4c
 * Used as fallback if Mirror Node auto-population fails
 */
export const LOCALNET_PAYER_ACCOUNT_ID = '0.0.1022';

export async function setupApp() {
  console.log(asciiArt); // Display ASCII art as the app starts
  const app = await launchHederaTransactionTool();
  const window = await app.firstWindow();
  const loginPage = new LoginPage(window);

  await window.evaluate(() => {
    (window as any).localStorage.clear();
    // window.localStorage.setItem('important-note-accepted', 'true');
  });

  expect(window).not.toBeNull();
  await loginPage.closeImportantNoteModal();
  const canMigrate = await migrationDataExists(app);
  if (canMigrate) {
    await loginPage.closeMigrationModal();
  }
  if (process.platform === 'darwin') {
    await loginPage.closeKeyChainModal();
  }

  // Check if we need to reset app state (if user exists from previous run)
  const isSettingsButtonVisible = await loginPage.isSettingsButtonVisible();
  if (isSettingsButtonVisible) {
    console.log('Existing user detected, resetting app state...');
    await resetAppState(window, app);
  }

  return { app, window };
}

export async function resetAppState(window: Page, app: ElectronApplication) {
  const loginPage = new LoginPage(window);
  await loginPage.resetState();
  const canMigrate = await migrationDataExists(app);
  if (canMigrate) {
    await loginPage.closeMigrationModal();
  }
}

export async function closeApp(app: ElectronApplication) {
  await app.close();
}

const LOCALNET_OPERATOR_KEY = '0x91132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137'; // genesis account key
const LOCALNET_OPERATOR_ACCOUNT = '0.0.2'; // genesis account ID

// Retrieves the private key from environment variables
export function getPrivateKeyEnv(): string | null {
  return process.env.PRIVATE_KEY && process.env.PRIVATE_KEY !== '' ? process.env.PRIVATE_KEY : null;
}

// Retrieves the operator private key from environment variables
export function getOperatorKeyEnv(): string {
  return process.env.OPERATOR_KEY && process.env.OPERATOR_KEY !== '' ? process.env.OPERATOR_KEY : LOCALNET_OPERATOR_KEY;
}

// Retrieves the network used from environment variables
export function getNetworkEnv(): string {
  return process.env.ENVIRONMENT && process.env.ENVIRONMENT !== '' ? process.env.ENVIRONMENT : 'LOCALNET';
}

export async function setupEnvironmentForTransactions(
  window: Page,
  privateKey = getPrivateKeyEnv(),
) {
  const network = getNetworkEnv().toUpperCase();
  if (network === 'LOCALNET') {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();

    if (privateKey === null) {
      // The private key is not configured so we are going to create a payer account using the
      // operator key, so we need to:
      //  - import the operator key
      //  - generate a key pair for the payer account
      //  - create the payer account using operator as payer, and transfer 10000 HBARs to it
      //  - delete the operator key
      //  - import the payer key which will further be used for all transactions
      await settingsPage.fillInED25519PrivateKey(getOperatorKeyEnv());
      await settingsPage.fillInED25519Nickname('Operator Account');
      await settingsPage.clickOnED25519ImportButton();

      const { publicKey, privateKey } = generateEd25519KeyPair();

      const transactionPage = new TransactionPage(window);
      await transactionPage.clickOnTransactionsMenuButton();
      await transactionPage.createNewAccount({
        initialFunds: '10000',
        publicKey: publicKey,
        payerAccountId: LOCALNET_OPERATOR_ACCOUNT,
      });

      await settingsPage.clickOnSettingsButton();
      await settingsPage.clickOnKeysTab();
      await settingsPage.clickOnDeleteButtonAtIndex(1);
      await settingsPage.clickOnDeleteKeyPairButton();

      await settingsPage.clickOnImportButton();
      await settingsPage.clickOnED25519DropDown();
      await settingsPage.fillInED25519PrivateKey(privateKey);
      await settingsPage.fillInED25519Nickname('Payer Account');
      await settingsPage.clickOnED25519ImportButton();
    } else {
      // The private key is configured so this is the one which will be used as payer for all transactions
      await settingsPage.fillInED25519PrivateKey(privateKey);
      await settingsPage.fillInED25519Nickname('Payer Account');
      await settingsPage.clickOnED25519ImportButton();
    const organizationPage = new OrganizationPage(window);
    await organizationPage.selectLocalNodeNetwork();
  }} else if (network === 'TESTNET') {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnECDSADropDown();
    await settingsPage.fillInECDSAPrivateKey(privateKey ?? '');
    await settingsPage.fillInECDSANickname('Payer Account');
    await settingsPage.clickOnECDSAImportButton();
    const organizationPage = new OrganizationPage(window);
    await organizationPage.selectTestnetNetwork();
  } else if (network === 'PREVIEWNET') {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnECDSADropDown();
    await settingsPage.fillInECDSAPrivateKey(privateKey ?? '');
    await settingsPage.fillInECDSANickname('Payer Account');
    await settingsPage.clickOnECDSAImportButton();
    const organizationPage = new OrganizationPage(window);
    await organizationPage.selectPreviewnetNetwork();
  } else {
    const settingsPage = new SettingsPage(window);
    await settingsPage.clickOnSettingsButton();
    await settingsPage.fillInMirrorNodeBaseURL(getNetworkEnv() ?? '');
    await settingsPage.clickOnKeysTab();
    await settingsPage.clickOnImportButton();
    await settingsPage.clickOnED25519DropDown();
    await settingsPage.fillInED25519PrivateKey(privateKey ?? '');
    await settingsPage.fillInED25519Nickname('Payer Account');
    await settingsPage.clickOnED25519ImportButton();
    const organizationPage = new OrganizationPage(window);
    await organizationPage.selectCustomNetwork();
  }
}

export const generateRandomEmail = (domain = 'test.com') => {
  const randomPart = Math.random().toString(36).substring(2, 8);
  return `${randomPart}@${domain}`;
};

export const generateRandomPassword = (length = 10) => {
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
export function formatTransactionId(transactionId: string): string {
  // Replace '@' with '-'
  let formattedId = transactionId.replace('@', '-');

  // Regex to find the first dot after a sequence of digits that follows the '-' replacing '@'
  // This regex specifically avoids changing any dots before the '-'
  formattedId = formattedId.replace(/-(\d+)\.(\d+)/, '-$1-$2');

  return formattedId;
}

export function calculateTimeout(totalUsers: number, timePerUser: number): number {
  return totalUsers * timePerUser * 2000;
}

/**
 * Waits for a valid start time to continue the test.
 * @param dateTimeString - The target date and time in string format.
 * @param bufferSeconds - The buffer time in seconds to wait before the target time.
 * @returns {Promise<void>} - A promise that resolves after the wait time.
 */
export async function waitForValidStart(dateTimeString: string, bufferSeconds = 15): Promise<void> {
  // Convert the dateTimeString to a Date object
  // Assume that the string is in UTC format
  const targetDate = new Date(dateTimeString + 'Z');

  // Get the current time
  const currentDate = new Date();

  // Calculate the difference in milliseconds
  const timeDifference = targetDate.getTime() - currentDate.getTime();

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
 * Waits for a file to exist within a specified timeout period.
 * @param filePath
 * @param timeout
 * @param interval
 * @returns {Promise<void>}
 */
export async function waitAndReadFile(
  filePath: string,
  timeout = 5000,
  interval = 100,
): Promise<Buffer> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await fsp.access(filePath);
      return await fsp.readFile(filePath);
    } catch {
      await new Promise(res => setTimeout(res, interval));
    }
  }
  throw new Error(`File not found: ${filePath}`);
}

/**
 * Compares two JSON data structures and reports differences.
 * @param {object} jsonData1 - The first JSON data object.
 * @param {object} jsonData2 - The second JSON data object.
 * @param {string[]} [keysToIgnore] - Optional array of keys to ignore during comparison.
 * @returns {object|null} - Returns null if objects are equal, or an array of differences.
 */
export function compareJsonFiles(
  jsonData1: Record<string, unknown>,
  jsonData2: Record<string, unknown>,
  keysToIgnore: string[] = [],
) {
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
export function removeKeys(
  obj: any,
  keysToRemove: string[],
): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeKeys(item, keysToRemove));
  } else if (typeof obj == 'object' && obj !== null) {
    return Object.keys(obj).reduce((acc: Record<string, unknown>, key: string) => {
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
export function parsePropertiesContent(content: string): Record<string, unknown> {
  const lines = content.split('\n');
  const obj: Record<string, unknown> = {};

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

/**
 * Extracts the clean account ID from a string containing a checksum.
 * For example, "0.0.1030-bmczp" returns "0.0.1030".
 *
 * @param {string} accountIdWithChecksum - The account ID string including the checksum.
 * @returns {string} The clean account ID.
 * @throws {Error} If the provided input is not a valid non-empty string.
 */
export function getCleanAccountId(accountIdWithChecksum: unknown): string {
  if (!accountIdWithChecksum || typeof accountIdWithChecksum !== 'string') {
    throw new Error('Invalid accountIdWithChecksum provided');
  }
  return accountIdWithChecksum.split('-')[0];
}

export const asciiArt =
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
