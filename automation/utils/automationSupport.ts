import { ElectronApplication, Page } from '@playwright/test';
import * as fsp from 'fs/promises';
import _ from 'lodash';
import Diff from 'deep-diff';
import { AppBootstrapper } from '../services/AppBootstrapper.js';
import { TransactionEnvironmentConfig } from '../services/TransactionEnvironmentConfig.js';
import { TransactionEnvironmentService } from '../services/TransactionEnvironmentService.js';
import { ENVIRONMENT_ENV_VAR } from '../constants/index.js';

export { asciiArt, AppBootstrapper } from '../services/AppBootstrapper.js';
export { TransactionEnvironmentConfig } from '../services/TransactionEnvironmentConfig.js';
export { KeyImportNavigator } from '../services/KeyImportNavigator.js';
export { LocalnetPayerProvisioner } from '../services/LocalnetPayerProvisioner.js';
export { TransactionEnvironmentService } from '../services/TransactionEnvironmentService.js';
export * from '../constants/index.js';

/**
 * Localnet payer account ID corresponding to the PRIVATE_KEY in .env
 * Solo account 0.0.1022 with key: 44162cd9b9a2f5582bd13b43cfd8be3bc20b8a81ee77f6bf77391598bcfbae4c
 * Used as fallback if Mirror Node auto-population fails
 */

const defaultAppBootstrapper = new AppBootstrapper();
const defaultTransactionEnvironmentConfig = new TransactionEnvironmentConfig();

export async function setupApp() {
  return defaultAppBootstrapper.setupApp();
}

export async function resetAppState(window: Page, app: ElectronApplication) {
  await defaultAppBootstrapper.resetAppState(window, app);
}

export async function closeApp(app: ElectronApplication) {
  await defaultAppBootstrapper.closeApp(app);
}

export function getPrivateKeyEnv(): string | null {
  return defaultTransactionEnvironmentConfig.getPrivateKey();
}

export function getOperatorKeyEnv(): string {
  return defaultTransactionEnvironmentConfig.getOperatorKey();
}

export function getNetworkEnv(): string {
  return defaultTransactionEnvironmentConfig.getNetwork();
}

export function isLocalnetEnvironment(environment = getNetworkEnv()): boolean {
  return new TransactionEnvironmentConfig({ [ENVIRONMENT_ENV_VAR]: environment }).isLocalnet();
}

export async function setupEnvironmentForTransactions(
  window: Page,
  privateKey = getPrivateKeyEnv(),
) {
  return new TransactionEnvironmentService(window, {
    config: defaultTransactionEnvironmentConfig,
  }).setupEnvironmentForTransactions(privateKey);
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
 * Waits until a transaction start time becomes valid.
 * Supports both Hedera UI format and ISO date formats.
 *
 * Examples supported:
 *  - "Wed, Feb 04, 2026 16:05:05 UTC"
 *  - "2026-02-04T16:05:05"
 *  - "2026-02-04T16:05:05Z"
 *
 * @param dateTimeString - The target date/time string.
 * @param bufferSeconds - Additional seconds to wait before execution.
 */
export async function waitForValidStart(
  dateTimeString: string,
  bufferSeconds: number = 15,
): Promise<void> {
  if (!dateTimeString || !dateTimeString.trim()) {
    console.log('waitForValidStart: start time is empty. Skipping wait.');
    return;
  }

  let normalizedDate = dateTimeString.trim();

  // Handle Hedera UI format: "Wed, Feb 04, 2026 16:05:05 UTC"
  if (normalizedDate.endsWith(' UTC')) {
    normalizedDate = normalizedDate.replace(' UTC', ' GMT');
  }

  // Handle ISO strings missing timezone
  if (
    !normalizedDate.endsWith('Z') &&
    !normalizedDate.includes('GMT') &&
    !normalizedDate.includes('+')
  ) {
    normalizedDate = `${normalizedDate}Z`;
  }

  const targetDate = new Date(normalizedDate);

  if (isNaN(targetDate.getTime())) {
    throw new Error(
      `waitForValidStart: invalid date string. Original: "${dateTimeString}", normalized: "${normalizedDate}"`,
    );
  }

  const now = new Date();
  const timeDifference = targetDate.getTime() - now.getTime();

  const waitTime = Math.max(timeDifference + bufferSeconds * 1000, 0);

  if (waitTime > 0) {
    const seconds = Math.ceil(waitTime / 1000);
    console.log(`Waiting ${seconds} seconds until transaction start time becomes valid...`);

    await new Promise(resolve => setTimeout(resolve, waitTime));
  } else {
    console.log('The target start time has already passed.');
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
