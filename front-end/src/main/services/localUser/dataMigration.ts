import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

import { app } from 'electron';
import * as argon2 from 'argon2';
import { AccountId } from '@hashgraph/sdk';

import { Network } from '@main/shared/enums';

import { addAccount } from './accounts';

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 12;

/*
  Data migration files are fixed, if the old tool is still in use. Perhaps a future feature will allow the user to
  select the location of the files, but for now, we will assume the files are in the default location
*/

/* Old Tools Constants */
const DEFAULT_FOLDER_NAME = 'TransactionTools';
const FILES = 'Files';
const USER_PROPERTIES = 'user.properties';
const RECOVERY_FILE_PARENT_FOLDER = '.System';
const RECOVERY_FILE = 'recovery.aes';
const KEYS = 'Keys';
const ACCOUNTS = 'Accounts';

const basePath = path.join(app.getPath('documents'), DEFAULT_FOLDER_NAME);
const propertiesPath = path.join(basePath, FILES, USER_PROPERTIES);
const mnemonicPath = path.join(basePath, FILES, RECOVERY_FILE_PARENT_FOLDER, RECOVERY_FILE);
const keysPath = path.join(basePath, KEYS);
const accountsPath = path.join(basePath, ACCOUNTS);

function getSalt(token: string): Buffer {
  /* If no token is provided, then return an empty buffer */
  if (!token) {
    console.error('Token is undefined');
    return Buffer.alloc(0);
  }

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

function generateArgon2id(password: string, salt: Buffer): Promise<Buffer> {
  const options = {
    type: argon2.argon2id,
    memoryCost: 262144, // 256MB
    timeCost: 3, // iterations
    parallelism: 1, // threads
    salt,
    raw: true, // get the raw bytes
  };

  // generate the key from the password using the options provided
  // @ts-ignore: the raw: true option will force the return type to be a buffer
  return argon2.hash(password, options);
}

async function decryptMnemonic(
  inputPath: string,
  token: string,
  password: string,
): Promise<string | null> {
  /* Read the encrypted data from the file */
  const data = await fs.promises.readFile(inputPath);

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
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    /* Decrypt the encrypted text */
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final();

    return decrypted;
  } catch (error) {
    return null;
  }
}

export async function locateDataMigrationFiles() {
  return fs.existsSync(basePath) && fs.existsSync(propertiesPath) && fs.existsSync(mnemonicPath);
}

export async function decryptMigrationMnemonic(password: string): Promise<string[] | null> {
  const content = await fs.promises.readFile(propertiesPath, 'utf-8');
  const parsedContent = parseUserProperties(content);

  const token = parsedContent.hash;
  if (!token) throw Error('No hash found at location');

  const words = await decryptMnemonic(mnemonicPath, token, password);
  if (words) return words.split(' ');

  return null;
}

export async function getDataMigrationKeysPath(): Promise<string> {
  return keysPath;
}

async function getAccountInfoFromFile(
  directory: string,
  defaultNetwork: Network = Network.MAINNET,
): Promise<{ nickname: string; accountID: string; network: Network }[]> {
  const accountDataList: { nickname: string; accountID: string; network: Network }[] = [];

  if (!fs.existsSync(directory)) return accountDataList;

  const files = await fs.promises.readdir(directory);

  for (const file of files.filter(f => f.endsWith('.json'))) {
    const loweredFileName = file.toLocaleLowerCase();

    const network = loweredFileName.includes('testnet')
      ? Network.TESTNET
      : loweredFileName.includes('mainnet')
        ? Network.MAINNET
        : loweredFileName.includes('previewnet')
          ? Network.PREVIEWNET
          : defaultNetwork;

    const filePath = path.join(directory, file);

    try {
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');

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

export async function migrateAccountsData(userId: string, network: Network): Promise<number> {
  const accountDataList = await getAccountInfoFromFile(accountsPath, network);

  for (const accountData of accountDataList) {
    await addAccount(userId, accountData.accountID, accountData.network, accountData.nickname);
  }
  return accountDataList.length;
}

function parseUserProperties(content: string): {
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
