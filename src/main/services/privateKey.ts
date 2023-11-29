import fs from 'fs/promises';
import path from 'path';

import { decrypt, encrypt } from '../utils/crypto';

import { Mnemonic, PrivateKey } from '@hashgraph/sdk';

// Private Keys Encrypted File Name
export const keyFileName = 'keys.json';

// Get Private Key Encrypted File Path
export const getPrivateKeysFilePath = (app: Electron.App) =>
  path.join(app.getPath('userData'), keyFileName);

// Generate Private Key from Mnemonic, Passphrase and Index
export const generateFromPhrase = async (mnemonic: Mnemonic, passphrase: string, index: number) =>
  mnemonic.toStandardEd25519PrivateKey(passphrase, index);

// Decrypt and get all stored Private Keys
export const getStoredPrivateKeys = async (filePath: string): Promise<PrivateKey[]> => {
  try {
    const encryptedKeys = await fs.readFile(filePath);

    const decryptedKeys = decrypt(encryptedKeys, process.env.KEYS_ENCRYPTION_KEY!);

    const stringifiedPrivateKeys: string[] = JSON.parse(decryptedKeys);

    return stringifiedPrivateKeys.map(pk => PrivateKey.fromStringED25519(pk));
  } catch {
    return [];
  }
};

// Add Private Key to encrypted file
export const addPrivateKeyEncrypted = async (filePath: string, privateKey: PrivateKey) => {
  const storedPrivateKeys = await getStoredPrivateKeys(filePath);
  const stringifiedPrivateKeys = storedPrivateKeys.map(pk => pk.toStringRaw());

  const newPrivateKeys = [...stringifiedPrivateKeys, privateKey.toStringRaw()];

  const encryptedPrivateKeys = encrypt(
    JSON.stringify(newPrivateKeys),
    process.env.KEYS_ENCRYPTION_KEY!,
  );

  await fs.writeFile(filePath, encryptedPrivateKeys);
};

// Remove Private Key from encrypted file
export const removePrivateKeyEncrypted = async (filePath: string, privateKey: PrivateKey) => {
  const storedKeyPairs = await getStoredPrivateKeys(filePath);

  const newKeyPairs = JSON.stringify(
    storedKeyPairs.filter(pk => pk.toStringRaw() !== privateKey.toStringRaw()),
  );

  const encryptedKeyPairs = encrypt(newKeyPairs, process.env.KEY_PAIRS_ENCRYPTION_KEY!);

  await fs.writeFile(filePath, encryptedKeyPairs);
};
