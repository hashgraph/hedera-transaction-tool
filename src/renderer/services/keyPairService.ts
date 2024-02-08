import { Key, KeyList, Mnemonic, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { KeyPair } from '@prisma/client';

/* Key Pairs Service */

/* Get stored key pairs */
export const getKeyPairs = (userId: string, organizationId?: string) =>
  window.electronAPI.keyPairs.getAll(userId, organizationId);

/* Get stored secret hashes */
export const getSecretHashes = (userId: string, organizationId?: string) =>
  window.electronAPI.keyPairs.getSecretHashes(userId, organizationId);

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

/* Store key pair*/
export const storeKeyPair = (keyPair: KeyPair, password: string) =>
  window.electronAPI.keyPairs.store(keyPair, password);

/* Change the decryption password of a stored private key */
export const changeDecryptionPassword = (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => window.electronAPI.keyPairs.changeDecryptionPassword(userId, oldPassword, newPassword);

/* Decrypt private key with user's password */
export const decryptPrivateKey = async (userId: string, password: string, publicKey: string) => {
  try {
    return await window.electronAPI.keyPairs.decryptPrivateKey(userId, password, publicKey);
  } catch (error) {
    throw new Error('Failed to decrypt private key/s');
  }
};

/* Hash recovery phrase */
export const hashRecoveryPhrase = (words: string[]) =>
  window.electronAPI.utils.hash(words.toString());

/* Delete all stored key pairs */
export const clearKeys = (userId: string, organizationId?: string) =>
  window.electronAPI.keyPairs.clear(userId, organizationId);

/* Delete the encrypted private keys from user's key pairs */
export const deleteEncryptedPrivateKeys = (userId: string, organizationId: string) =>
  window.electronAPI.keyPairs.deleteEncryptedPrivateKeys(userId, organizationId);

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

/* Delete Key Pair */
export const deleteKeyPair = async (keyPairId: string) => {
  return await window.electronAPI.keyPairs.deleteKeyPair(keyPairId);
};

/* TLD Updates a key list */
export const updateKeyList = (
  keyList: KeyList,
  path: number[],
  publicKey?: string | null,
  threshold?: number,
) => {
  const keys = keyList.toArray();

  for (let i = 0; i < keyList._keys.length; i++) {
    const key = keyList._keys[i];

    if (path[0] === i) {
      if (key instanceof KeyList) {
        keys[i] = updateKeyList(key, path.slice(1), publicKey, threshold);
      } else {
        publicKey ? (keys[i] = PublicKey.fromString(publicKey)) : '';
      }
    } else {
      keys[i] = key;
    }
  }

  const resultThreshold = path.length === 1 ? threshold : keyList.threshold;
  return new KeyList(keys, resultThreshold);
};

/* Flattens a key list to public keys*/
export const flattenKeyList = (keyList: Key): PublicKey[] => {
  const protobufKey = keyList._toProtobufKey();

  let keys: PublicKey[] = [];
  const keysString: string[] = [];

  formatKey(protobufKey);

  function getPublicKeyFromIKey(ikey: proto.Key) {
    if (ikey.ed25519) {
      return PublicKey.fromBytesED25519(ikey.ed25519);
    }
    if (ikey.ECDSASecp256k1) {
      return PublicKey.fromBytesECDSA(ikey.ECDSASecp256k1);
    }

    return undefined;
  }

  function formatKey(key: any) {
    if (key.thresholdKey) {
      key.thresholdKey.keys?.keys.forEach((key: proto.Key) => {
        formatKey(key);
      });
    } else if (key.keyList) {
      keys = key.keyList.keys.map((k: proto.Key) => getPublicKeyFromIKey(k));
    } else {
      const pk = getPublicKeyFromIKey(key);
      if (pk && !keysString.includes(pk.toStringRaw())) {
        keys.push(pk);
        keysString.push(pk.toStringRaw());
      }
    }
  }
  return keys;
};

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
