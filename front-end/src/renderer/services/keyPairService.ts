import { Key, KeyList, Mnemonic, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

/* Key Pairs Service */

/* Get stored key pairs */
export const getKeyPairs = async (userId: string, organizationId?: string | null) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.getAll(userId, organizationId);
  }, 'Failed to fetch key pairs');

/* Get stored secret hashes */
export const getSecretHashes = async (userId: string, organizationId?: string | null) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.getSecretHashes(userId, organizationId);
  }, 'Failed to fetch secret hashes');

/* Store key pair*/
export const storeKeyPair = async (
  keyPair: Prisma.KeyPairUncheckedCreateInput,
  password: string,
  encrypted: boolean,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.store(keyPair, password, encrypted);
  }, 'Failed to store key pair');

/* Change the decryption password of a stored private key */
export const changeDecryptionPassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.changeDecryptionPassword(
      userId,
      oldPassword,
      newPassword,
    );
  }, 'Failed to change decryption password');

/* Decrypt private key with user's password */
export const decryptPrivateKey = async (userId: string, password: string, publicKey: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.decryptPrivateKey(userId, password, publicKey);
  }, 'Failed to decrypt private key/s');

/* Delete all stored key pairs */
export const clearKeys = async (userId: string, organizationId?: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.clear(userId, organizationId);
  }, 'Failed to clear key pairs');

/* Delete the encrypted private keys from user's key pairs */
export const deleteEncryptedPrivateKeys = async (userId: string, organizationId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.deleteEncryptedPrivateKeys(
      userId,
      organizationId,
    );
  }, 'Failed to delete encrypted private keys');

/* Delete Key Pair */
export const deleteKeyPair = async (keyPairId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.keyPairs.deleteKeyPair(keyPairId);
  }, 'Failed to delete keys pair');

/* Validates if the provided recovery phrase is valid according to BIP-39 */
export const validateMnemonic = async (words: string[]) => {
  try {
    words = words.map(w => w.toLocaleLowerCase());
    await Mnemonic.fromWords(words);
    return true;
  } catch (error) {
    return false;
  }
};

/* Restore private key from recovery phrase */
export const restorePrivateKey = async (
  words: string[],
  passphrase: string,
  keyIndex: number,
  type: 'ECDSA' | 'ED25519',
) => {
  if (words.length !== 24) {
    throw Error('Invalid Recovery Phrase');
  }

  const mnemonic = await Mnemonic.fromWords(words);

  switch (type) {
    case 'ED25519':
      return mnemonic.toStandardEd25519PrivateKey(passphrase, keyIndex);
    case 'ECDSA':
      return mnemonic.toStandardECDSAsecp256k1PrivateKey(passphrase, keyIndex);
    default:
      throw new Error('Key type not supported');
  }
};

/* Flattens a key list to public keys*/
export function flattenKeyList(keyList: Key): PublicKey[] {
  if (keyList instanceof PublicKey) {
    return [keyList];
  }

  if (!(keyList instanceof KeyList)) {
    throw new Error('Invalid key list');
  }

  const keys: Set<string> = new Set<string>();

  keyList.toArray().forEach(key => {
    if (key instanceof PublicKey) {
      keys.add(key.toStringRaw());
    } else if (key instanceof KeyList) {
      const pks = flattenKeyList(key);
      pks.forEach(pk => keys.add(pk.toStringRaw()));
    }
  });

  return [...keys].map(k => PublicKey.fromString(k));
}

export const getKeyListLevels = (keyList: KeyList) => {
  const result: { key: proto.Key; level: number }[] = [];

  flattenComplexKey(keyList._toProtobufKey(), 0, result);

  let maxLevel = 1;
  for (const level of result.map(r => r.level)) {
    maxLevel = Math.max(maxLevel, level);
  }
  return maxLevel + 1;
};

export const generateExternalKeyPairFromString = (
  privateKey: string,
  type: 'ECDSA' | 'ED25519',
  nickname: string,
  index?: number,
): {
  index: number;
  public_key: string;
  private_key: string;
  nickname: string | null;
} => {
  try {
    let privateKeyInstance;
    if (type === 'ECDSA') {
      privateKeyInstance = PrivateKey.fromStringECDSA(privateKey);
    } else if (type === 'ED25519') {
      privateKeyInstance = PrivateKey.fromStringED25519(privateKey);
    }

    return {
      nickname,
      private_key: privateKeyInstance.toStringRaw(),
      public_key: privateKeyInstance.publicKey.toStringRaw(),
      index: index || -1,
    };
  } catch (error) {
    console.log(error);
    throw new Error(`Invalid ${type} Private key`);
  }
};

function flattenComplexKey(
  key: proto.Key,
  level: number,
  result: { key: proto.Key; level: number }[],
): void {
  let newLine: { key: proto.Key; level: number } | null;
  let childKeys: proto.Key[];
  if (key.keyList) {
    if (key.keyList.keys && key.keyList.keys.length == 1) {
      newLine = null;
      childKeys = [key.keyList.keys[0]];
    } else {
      newLine = { key, level };
      childKeys = key.keyList?.keys ?? [];
    }
  } else if (key.thresholdKey) {
    if (key.thresholdKey.keys?.keys && key.thresholdKey.keys?.keys.length == 1) {
      newLine = null;
      childKeys = [key.thresholdKey.keys?.keys[0]];
    } else {
      newLine = { key, level };

      childKeys = key.thresholdKey?.keys?.keys ?? [];
    }
  } else {
    newLine = { key, level };

    childKeys = [];
  }
  if (newLine !== null) {
    result.push(newLine);
  }

  const nextLevel = newLine !== null ? level + 1 : level;
  for (const childKey of childKeys) {
    flattenComplexKey(childKey, nextLevel, result);
  }
}
