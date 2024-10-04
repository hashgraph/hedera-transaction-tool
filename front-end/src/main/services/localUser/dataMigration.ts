import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as argon2 from 'argon2';
import * as dotenv from 'dotenv';
import { addAccount } from './accounts';
import { Network } from '@main/shared/enums';

const SALT_LENGTH = 16;
const KEY_LENGTH = 32;
const AUTH_TAG_LENGTH = 16;
const IV_LENGTH = 12;

// data migration files are fixed, if the old tool is still in use. Perhaps a future feature will allow the user to
// select the location of the files, but for now, we will assume the files are in the default location
const basePath = path.join(process.env.HOME || process.env.USERPROFILE || '', 'Documents', 'TransactionTools');
const propertiesPath = path.join(basePath, 'Files','user.properties');
const mnemonicPath = path.join(basePath, 'Files', '.System', 'recovery.aes');
const keysPath = path.join(basePath, 'Keys');
const accountsPath = path.join(basePath, 'Accounts');

function getSalt(token: string): Buffer {
  // If no token is provided, then return an empty buffer
  if (!token) {
    console.error("Token is undefined");
    return Buffer.alloc(0);
  }
  // Decode the token from base64
  const tokenBytes = Buffer.from(token, 'base64');
  // If the length of the token is less than the sum of the salt length and the key length, then the token is invalid
  if (tokenBytes.length < SALT_LENGTH + KEY_LENGTH) {
    console.error("Token size check failed");
    return Buffer.alloc(0);
  }
  // Get the salt from the token (the first SALT_LENGTH of bytes) and return it
  return tokenBytes.slice(0, SALT_LENGTH);
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

async function decryptMnemonic(inputPath: string, token: string, password: string): Promise<string | null> {
  // Read the encrypted data from the file
  const data = fs.readFileSync(inputPath);

  // Get the salt from the token
  const salt = getSalt(token);

  // Generate the key from the password and the salt
  const key = await generateArgon2id(password, salt);

  // Get the header, auth tag, encrypted text, and IV from the data
  const header = Buffer.from("AES|256|CBC|PKCS5Padding|", 'utf8');
  const authTag = data.slice(data.length - AUTH_TAG_LENGTH);
  const encryptedText = data.slice(header.length + IV_LENGTH, data.length - AUTH_TAG_LENGTH);
  const iv = data.slice(header.length, header.length + IV_LENGTH);

  // Create a decipher, set the auth tag
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  try {
    // Decrypt the encrypted text
    let decrypted = decipher.update(encryptedText, undefined, 'utf8');
    decrypted += decipher.final();

    return decrypted;
  } catch (error) {
    // console.error('Error decrypting mnemonic:', error);
    return null;
  }
}

function loadUserProperties(path: string): boolean {
  // Load the .properties file
  //TODO we dont want to use dotenv, remove it and go another route
  const result = dotenv.config({ path });
  return result.error === undefined;
}

export async function locateDataMigrationFiles() {
    return fs.existsSync(basePath) && fs.existsSync(propertiesPath) && fs.existsSync(mnemonicPath);
}

export async function decryptMigrationMnemonic(password: string): Promise<string[] | null> {
  loadUserProperties(propertiesPath);

  // Get the hash property from user.properties
  const token = process.env.hash;
  if (!token) {
    throw Error('No hash found at location');
  }

  const words = await decryptMnemonic(mnemonicPath, token, password);
  if (words) {
    return words.split(' ');
  }
  return null;
}

export async function getDataMigrationKeysPath(): Promise<string> {
  return keysPath;
}

async function getAccountInfoFromFile(directory: string): Promise<{ nickname: string, accountID: string }[]> {
  const accountDataList: { nickname: string, accountID: string }[] = [];
  if (!fs.existsSync(directory)) {
    return accountDataList;
  }
  const files = fs.readdirSync(directory);

  for (const file of files) {
    if (file.endsWith('.json')) {
      const filePath = path.join(directory, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const accountID = JSON.parse(fileContent)?.accountID;

      if (accountID) {
        const accountIDString = `${accountID.shard}-${accountID.realm}-${accountID.num}`;
        accountDataList.push({
          nickname: path.parse(file).name,
          accountID: accountIDString,
        });
      }
    }
  }

  return accountDataList;
}

export async function migrateAccountsData(userId: string, network: Network): Promise<number> {
  const accountDataList = await getAccountInfoFromFile(accountsPath);
  for (const accountData of accountDataList) {
    await addAccount(userId, accountData.accountID, network, accountData.nickname);
  }
  return accountDataList.length;
}
