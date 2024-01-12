import { Key, KeyList, Mnemonic, PublicKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { IKeyPair } from '../../main/shared/interfaces';

/* Key Pairs Service */

/* Get stored key pairs */
export const getStoredKeyPairs = (
  email: string,
  serverUrl?: string,
  userId?: string,
  secretHash?: string,
  secretHashName?: string,
) => window.electronAPI.keyPairs.getStored(email, serverUrl, userId, secretHash, secretHashName);

/* Get stored secret hashes */
export const getStoredKeysSecretHashes = (email: string, serverUrl?: string, userId?: string) =>
  window.electronAPI.keyPairs.getStoredKeysSecretHashes(email, serverUrl, userId);

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

/* Store key pair along with its recovery phrase hash */
export const storeKeyPair = (
  email: string,
  password: string,
  secretHash: string,
  keyPair: IKeyPair,
  serverUrl?: string,
  userId?: string,
) => window.electronAPI.keyPairs.store(email, password, secretHash, keyPair, serverUrl, userId);

/* Change the decryption password of a stored private key */
export const changeDecryptionPassword = (email: string, oldPassword: string, newPassword: string) =>
  window.electronAPI.keyPairs.changeDecryptionPassword(email, oldPassword, newPassword);

/* Decrypt private key with user's password */
export const decryptPrivateKey = async (email: string, password: string, publicKey: string) => {
  try {
    return await window.electronAPI.keyPairs.decryptPrivateKey(email, password, publicKey);
  } catch (error) {
    throw new Error('Failed to decrypt private key/s');
  }
};

/* Hash recovery phrase */
export const hashRecoveryPhrase = (words: string[]) =>
  window.electronAPI.utils.hash(words.toString());

/* Delete all stored key pairs */
export const clearKeys = (email: string, serverUrl?: string, userId?: string) =>
  window.electronAPI.keyPairs.clear(email, serverUrl, userId);

/* Delete the encrypted private keys from user's key pairs */
export const deleteEncryptedPrivateKeys = (email: string, serverUrl: string, userId: string) =>
  window.electronAPI.keyPairs.deleteEncryptedPrivateKeys(email, serverUrl, userId);

/* Validates if the provided recovery phrase is valid according to BIP-39 */
export const validateMnemonic = async (words: string[]) => {
  try {
    await Mnemonic.fromWords(words);
    return true;
  } catch (error) {
    return false;
  }
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
        publicKey ? (keys[i] = PublicKey.fromStringED25519(publicKey)) : '';
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
