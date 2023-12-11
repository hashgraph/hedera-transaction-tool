import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';

import { decrypt, encrypt } from '../utils/crypto';

import { IKeyPair } from '../shared/interfaces/IKeyPair';

// Get key pairs Encrypted File Path
export const getKeyPairsFilePath = (app: Electron.App, userId: string) =>
  path.join(app.getPath('userData'), `${userId}.json`);

// Decrypt and get all stored key pairs
export const getStoredKeyPairs = async (filePath: string): Promise<IKeyPair[]> => {
  let keyPairs: IKeyPair[] = [];
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    keyPairs = JSON.parse(data);
  }

  return keyPairs;
};

// Store key pair
export const storeKeyPair = async (filePath: string, password: string, keyPair: IKeyPair) => {
  keyPair.privateKey = await encrypt(keyPair.privateKey, password);

  let keyPairs: IKeyPair[] = [];
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    keyPairs = JSON.parse(data);
  }

  keyPairs.push(keyPair);

  fs.writeFileSync(filePath, JSON.stringify(keyPairs), 'utf8');
};

// Change decryption password
export const changeDecryptionPassword = async (
  filePath: string,
  oldPassword: string,
  newPassword: string,
) => {
  let keyPairs: IKeyPair[] = [];
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    keyPairs = JSON.parse(data);
  }

  keyPairs = keyPairs.map(kp => {
    const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
    const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

    return { ...kp, privateKey: encryptedPrivateKey };
  });

  fs.writeFileSync(filePath, JSON.stringify(keyPairs), 'utf8');

  return keyPairs;
};

// Decrypt user's private key
export const decryptPrivateKey = async (filePath: string, password: string, publicKey: string) => {
  const userKeyPairs = await getStoredKeyPairs(filePath);

  const searchedKeyPair = userKeyPairs.find(kp => kp.publicKey === publicKey);

  const decryptedPrivateKey = decrypt(searchedKeyPair?.privateKey, password);

  return decryptedPrivateKey;
};

// Clear user's keys
export const clearKeys = (filePath: string) => fsp.unlink(filePath);
