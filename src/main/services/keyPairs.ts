import fsp from 'fs/promises';
import fs from 'fs';
import path from 'path';

import { decrypt, encrypt } from '../utils/crypto';

import { IKeyPair, IStoredSecretHash } from '../shared/interfaces';

// Get key pairs Encrypted File Path
export const getKeyPairsFilePath = (app: Electron.App, userId: string) =>
  path.join(app.getPath('userData'), `${userId}.json`);

//Get all stored secret hash objects
export const getStoredSecretHashes = async (filePath: string) => {
  let storedSecretHashes: IStoredSecretHash[] = [];

  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    storedSecretHashes = JSON.parse(data);
  }

  if (
    storedSecretHashes.length > 0 &&
    !Object.prototype.hasOwnProperty.call(storedSecretHashes[0], 'secretHash') &&
    !Object.prototype.hasOwnProperty.call(storedSecretHashes[0], 'keyPairs')
  ) {
    await deleteSecretHashesFile(filePath);
    storedSecretHashes = [];
  }

  return storedSecretHashes;
};

//Get all stored key pairs
export const getStoredKeyPairs = async (
  filePath: string,
  secretHash?: string,
  secretHashName?: string,
): Promise<IKeyPair[]> => {
  const storedSecretHashes = await getStoredSecretHashes(filePath);

  if (secretHashName) {
    return storedSecretHashes.find(sh => sh.name === secretHashName)?.keyPairs || [];
  }

  if (secretHash) {
    return storedSecretHashes.find(sh => sh.secretHash === secretHash)?.keyPairs || [];
  }

  return storedSecretHashes.map(sh => sh.keyPairs).flat();
};

// Get secret hashes of currently saved keys
export const getStoredKeysSecretHashes = async (filePath: string): Promise<string[]> => {
  const storedSecretHashes = await getStoredSecretHashes(filePath);

  return storedSecretHashes.map(sh => sh.secretHash);
};

// Store key pair
export const storeKeyPair = async (
  filePath: string,
  password: string,
  secretHash: string,
  keyPair: IKeyPair,
) => {
  keyPair.privateKey = await encrypt(keyPair.privateKey, password);

  const storedSecretHashes = await getStoredSecretHashes(filePath);

  const storedSecretHash = storedSecretHashes.find(sh => sh.secretHash === secretHash);

  if (storedSecretHash) {
    const s_keyPair = storedSecretHash.keyPairs.find(kp => kp.publicKey === keyPair.publicKey);

    if (s_keyPair) {
      s_keyPair.privateKey = keyPair.privateKey;
    } else {
      storedSecretHash.keyPairs.push(keyPair);
    }
  } else {
    storedSecretHashes.push({ secretHash, keyPairs: [keyPair] });
  }

  fs.writeFileSync(filePath, JSON.stringify(storedSecretHashes), 'utf8');
};

// Change decryption password
export const changeDecryptionPassword = async (
  filePath: string,
  oldPassword: string,
  newPassword: string,
) => {
  let storedSecretHashes: IStoredSecretHash[] = [];
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath, 'utf8');
    storedSecretHashes = JSON.parse(data);
  }

  storedSecretHashes.forEach(sh => {
    sh.keyPairs = sh.keyPairs.map(kp => {
      const decryptedPrivateKey = decrypt(kp.privateKey, oldPassword);
      const encryptedPrivateKey = encrypt(decryptedPrivateKey, newPassword);

      return { ...kp, privateKey: encryptedPrivateKey };
    });
  });

  fs.writeFileSync(filePath, JSON.stringify(storedSecretHashes), 'utf8');

  return storedSecretHashes;
};

// Decrypt user's private key
export const decryptPrivateKey = async (filePath: string, password: string, publicKey: string) => {
  const userKeyPairs = await getStoredKeyPairs(filePath);

  const searchedKeyPair = userKeyPairs.find(kp => kp.publicKey === publicKey);

  const decryptedPrivateKey = decrypt(searchedKeyPair?.privateKey, password);

  return decryptedPrivateKey;
};

// Delete encrypted private keys
export const deleteEncryptedPrivateKeys = async (filePath: string) => {
  const storedSecretHashes = await getStoredSecretHashes(filePath);

  storedSecretHashes.forEach(sh => {
    sh.keyPairs.forEach(kp => {
      kp.privateKey = '';
    });
  });

  fs.writeFileSync(filePath, JSON.stringify(storedSecretHashes), 'utf8');
};

// Clear user's keys
export const deleteSecretHashesFile = (filePath: string) => fsp.unlink(filePath);
