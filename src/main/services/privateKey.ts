import fs from 'fs/promises';
import path from 'path';

import { decrypt, encrypt } from '../utils/crypto';

import { PrivateKey } from '@hashgraph/sdk';

// Private Keys Encrypted File Name
export const keyFileName = 'keys.json';

// Get Private Key Encrypted File Path
export const getPrivateKeysFilePath = (app: Electron.App) =>
  path.join(app.getPath('userData'), keyFileName);

// Decrypt and get all stored Private Keys
export const getStoredPrivateKeys = async (
  filePath: string,
): Promise<{ privateKey: PrivateKey; index: number }[]> => {
  try {
    const encryptedKeys = await fs.readFile(filePath);

    const decryptedKeys = decrypt(encryptedKeys, process.env.KEYS_ENCRYPTION_KEY!);

    const stringifiedPrivateKeys: { privateKey: string; index: number }[] =
      JSON.parse(decryptedKeys);

    return stringifiedPrivateKeys.map(pk => ({
      privateKey: PrivateKey.fromStringED25519(pk.privateKey),
      index: pk.index,
    }));
  } catch {
    return [];
  }
};

// Add Private Key to encrypted file
export const addPrivateKeyEncrypted = async (
  filePath: string,
  privateKey: PrivateKey,
  index: number,
) => {
  const storedPrivateKeys = await getStoredPrivateKeys(filePath);
  const stringifiedPrivateKeys = storedPrivateKeys.map(pk => ({
    privateKey: pk.privateKey.toStringRaw(),
    index: pk.index,
  }));

  const newPrivateKeys = [
    ...stringifiedPrivateKeys,
    { privateKey: privateKey.toStringRaw(), index },
  ];

  const encryptedPrivateKeys = encrypt(
    JSON.stringify(newPrivateKeys),
    process.env.KEYS_ENCRYPTION_KEY!,
  );

  await fs.writeFile(filePath, encryptedPrivateKeys);
};

// Remove Private Key from encrypted file
export const removePrivateKeyEncrypted = async (filePath: string, privateKey: PrivateKey) => {
  const storedPrivateKeys = await getStoredPrivateKeys(filePath);

  const newPrivateKeys = JSON.stringify(
    storedPrivateKeys.filter(pk => pk.privateKey.toStringRaw() !== privateKey.toStringRaw()),
  );

  const encryptedPrivateKeys = encrypt(newPrivateKeys, process.env.KEY_PAIRS_ENCRYPTION_KEY!);

  await fs.writeFile(filePath, encryptedPrivateKeys);
};
