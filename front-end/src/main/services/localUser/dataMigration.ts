import type { Network } from '@main/shared/interfaces';

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { app } from 'electron';
import * as argon2 from 'argon2';
import { AccountId, Hbar, HbarUnit } from '@hashgraph/sdk';

import { CommonNetwork } from '@main/shared/enums';
import { MigrateUserDataResult } from '@main/shared/interfaces/migration';
import {
  DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
  SELECTED_NETWORK,
  UPDATE_LOCATION,
} from '@main/shared/constants';

import { parseNetwork } from '@main/utils/parsers';
import { safeAwait } from '@main/utils/safeAwait';

import { addAccount } from './accounts';
import { addClaim } from './claim';
import { addPublicKey } from './publicKeyMapping';

export const SALT_LENGTH = 16;
export const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 12;

/*
  Data migration files are fixed, if the old tool is still in use. Perhaps a future feature will allow the user to
  select the location of the files, but for now, we will assume the files are in the default location
*/

/* Old Tools Constants */
const DEFAULT_FOLDER_NAME = 'TransactionTools';
const FILES = 'Files';
const KEYS = 'Keys';
const ACCOUNTS = 'Accounts';
const RECOVERY_FILE_PARENT_FOLDER = '.System';
const RECOVERY_FILE = 'recovery.aes';
const USER_PROPERTIES = 'user.properties';

const USER_PROPERTIES_DEFAULT_MAX_TRANSACTION_FEE_KEY = 'defaultTxFee';
const USER_PROPERTIES_CURRENT_NETWORK_KEY = 'currentNetwork';
const CREDENTIALS_DIRECTORY = 'credentials';

/* Get the 'HederaTools' folder in the documents directory */
const getBasePath = () => {
  return path.join(app.getPath('documents'), DEFAULT_FOLDER_NAME);
};
/* Get the path to the user properties */
const getPropertiesPath = () => {
  return path.join(getBasePath(), FILES, USER_PROPERTIES);
};
/* Get the path to the recovery phrase file */
const getMnemonicPath = () => {
  return path.join(getBasePath(), FILES, RECOVERY_FILE_PARENT_FOLDER, RECOVERY_FILE);
};
/* Get the path to the keys folder */
const getKeysPath = () => {
  return path.join(getBasePath(), KEYS);
};
/* Get the path to the accounts folder */
const getAccountsPath = () => {
  return path.join(getBasePath(), ACCOUNTS);
};

export function getSalt(token: string): Buffer {
  /* Decode the token from base64 */
  const tokenBytes = Buffer.from(token, 'base64');

  /* If the length of the token is less than the sum of the salt length and the key length, then the token is invalid */
  if (tokenBytes.length < SALT_LENGTH + KEY_LENGTH) {
    console.error('Token size check failed');
    return Buffer.alloc(0);
  }

  /* Get the salt from the token (the first SALT_LENGTH of bytes) and return it */
  return tokenBytes.subarray(0, SALT_LENGTH);
}

export async function generateArgon2id(password: string, salt: Buffer) {
  const options = {
    type: argon2.argon2id,
    memoryCost: 262144, // 256MB
    timeCost: 3, // iterations
    parallelism: 1, // threads
    salt,
    raw: true, // get the raw bytes
  };
  return argon2.hash(password, options);
}

export async function decryptLegacyMnemonic(
  inputPath: string,
  password: string,
): Promise<string | null> {
  /* Read the encrypted data from the file */
  const data = await fs.promises.readFile(inputPath, { flag: 'r' });

  const iterationCount = 65536;
  const keyLength = 32; // 256 bits
  const salt = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);

  const key = crypto.pbkdf2Sync(password, salt, iterationCount, keyLength, 'sha256');
  const header = Buffer.from('AES|256|CBC|PKCS5Padding|', 'utf-8');
  if (data.length < header.length || !header.equals(data.slice(0, header.length))) {
    const decipher = crypto.createDecipheriv('aes-256-ecb', key, null);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf-8');
  }

  return null;
}

export async function decryptMnemonic(
  inputPath: string,
  token: string,
  password: string,
): Promise<string | null> {
  /* Read the encrypted data from the file */
  const data = await fs.promises.readFile(inputPath, { flag: 'r' });

  /* Get the salt from the token */
  const salt = getSalt(token);

  /* Generate the key from the password and the salt */
  const key = await generateArgon2id(password, salt);

  /* Get the header, auth tag, encrypted text, and IV from the data */
  const header = Buffer.from('AES|256|CBC|PKCS5Padding|', 'utf8');
  const authTag = data.subarray(data.length - AUTH_TAG_LENGTH);
  const encryptedText = data.subarray(header.length + IV_LENGTH, data.length - AUTH_TAG_LENGTH);
  const iv = data.subarray(header.length, header.length + IV_LENGTH);

  /* Create a decipher, set the auth tag */
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, new Uint8Array(iv));
  decipher.setAuthTag(new Uint8Array(authTag));

  try {
    /* Decrypt the encrypted text */
    const decrypted = Buffer.concat([decipher.update(encryptedText), decipher.final()]);
    return decrypted.toString('utf-8');
  } catch (error) {
    console.log('Error decrypting mnemonic:', error);
    return null;
  }
}

export function locateDataMigrationFiles() {
  return (
    fs.existsSync(getBasePath()) &&
    fs.existsSync(getPropertiesPath()) &&
    fs.existsSync(getMnemonicPath())
  );
}

export async function decryptMigrationMnemonic(password: string): Promise<string[] | null> {
  const content = await fs.promises.readFile(getPropertiesPath(), { encoding: 'utf-8', flag: 'r' });
  const parsedContent = parseUserProperties(content);

  const token = parsedContent.hash;
  if (!token) throw Error('No hash found at location');

  const isLegacy = parsedContent.legacy;

  let words: string | null;
  if (isLegacy) {
    words = await decryptLegacyMnemonic(getMnemonicPath(), password);
  } else {
    words = await decryptMnemonic(getMnemonicPath(), token, password);
  }

  if (words) return words.split(' ');

  return null;
}

export function getDataMigrationKeysPath(): string {
  return getKeysPath();
}

export async function getAccountInfoFromFile(
  directory: string,
  defaultNetwork: Network = CommonNetwork.MAINNET,
): Promise<{ nickname: string; accountID: string; network: Network }[]> {
  const accountDataList: { nickname: string; accountID: string; network: Network }[] = [];

  if (!fs.existsSync(directory)) return accountDataList;

  const files = await fs.promises.readdir(directory);

  for (const file of files.filter(f => f.endsWith('.json'))) {
    const filePath = path.join(directory, file);

    try {
      const network = parseNetwork(file, defaultNetwork);

      const fileContent = await fs.promises.readFile(filePath, { encoding: 'utf-8', flag: 'r' });

      const accountID = JSON.parse(fileContent)?.accountID;

      if (accountID) {
        const accountIDString = AccountId._fromProtobuf(accountID).toString();

        accountDataList.push({
          nickname: path.parse(file).name,
          accountID: accountIDString,
          network,
        });
      }
    } catch (error) {
      console.error(`Error reading file ${filePath}: ${error}`);
    }
  }

  return accountDataList;
}

export async function migrateUserData(userId: string): Promise<MigrateUserDataResult> {
  let defaultNetwork: Network = CommonNetwork.MAINNET;

  const result: MigrateUserDataResult = {
    accountsImported: 0,
    publicKeysImported: 0,
    defaultMaxTransactionFee: null,
    currentNetwork: defaultNetwork,
  };

  try {
    const content = await fs.promises.readFile(getPropertiesPath(), {
      encoding: 'utf-8',
      flag: 'r',
    });
    const parsedContent = parseUserProperties(content);

    const defaultMaxTransactionFee = Number(
      parsedContent[USER_PROPERTIES_DEFAULT_MAX_TRANSACTION_FEE_KEY],
    );
    if (!isNaN(defaultMaxTransactionFee)) {
      result.defaultMaxTransactionFee = defaultMaxTransactionFee;
      const { error } = await safeAwait(
        addClaim(
          userId,
          DEFAULT_MAX_TRANSACTION_FEE_CLAIM_KEY,
          Hbar.fromTinybars(result.defaultMaxTransactionFee).toString(HbarUnit.Tinybar),
        ),
      );
      if (error) {
        console.log(error);
      }
    }

    defaultNetwork = parseNetwork(
      parsedContent[USER_PROPERTIES_CURRENT_NETWORK_KEY],
      defaultNetwork,
    );
    result.currentNetwork = defaultNetwork;
    const { error } = await safeAwait(addClaim(userId, SELECTED_NETWORK, defaultNetwork));
    if (error) {
      console.log(error);
    }

    const credentialsObj = parsedContent[CREDENTIALS_DIRECTORY];
    if (credentialsObj && typeof credentialsObj === 'object') {
      let updatesLocation = Object.keys(credentialsObj)[0];
      updatesLocation = updatesLocation.endsWith('/InputFiles')
        ? updatesLocation
        : updatesLocation + '/InputFiles';
      const { error } = await safeAwait(addClaim(userId, UPDATE_LOCATION, updatesLocation));
      if (error) {
        console.log(error);
      }
    }
  } catch (error) {
    console.log(error);
  }

  try {
    const accountDataList = await getAccountInfoFromFile(getAccountsPath(), defaultNetwork);

    for (const accountData of accountDataList) {
      const { error } = await safeAwait(
        addAccount(userId, accountData.accountID, accountData.network, accountData.nickname),
      );
      if (error) {
        console.log(error);
      } else {
        result.accountsImported++;
      }
    }
  } catch (error) {
    console.log(error);
  }

  try {
    const keysPath = getDataMigrationKeysPath();
    if (fs.existsSync(keysPath)) {
      const files = await fs.promises.readdir(keysPath);
      const pemFiles = new Set(
        files.filter(file => file.endsWith('.pem')).map(file => path.parse(file).name)
      );

      for (const file of files.filter(file => file.endsWith('.pub') && !pemFiles.has(path.parse(file).name))) {
        const filePath = path.join(keysPath, file);
        const publicKeyContent = await fs.promises.readFile(filePath, 'utf-8');
        const nickname = path.basename(filePath, '.pub');
        await addPublicKey(publicKeyContent, nickname);
        result.publicKeysImported++;
      }
    }
  } catch (error) {
    console.log(error);
  }

  return result;
}

export function parseUserProperties(content: string): {
  [key: string]: any;
} {
  const lines = content.split('\n');
  const result: {
    [key: string]: any;
  } = {};

  for (const line of lines) {
    if (line.trim() === '') continue;

    let [key, value] = line.split('=');
    key = key?.trim();
    value = value?.trim();

    if (!key || !value) continue;

    if (value.startsWith('{') && value.endsWith('}')) {
      value = value.replace(/\\:/g, ':');
      result[key] = JSON.parse(value);
    } else if (value === 'true' || value === 'false') {
      result[key] = value === 'true';
    } else if (!isNaN(Number(value))) {
      result[key] = Number(value);
    } else {
      result[key] = value;
    }
  }

  return result;
}
