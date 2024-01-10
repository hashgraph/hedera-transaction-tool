import axios from 'axios';

import { Key, KeyList, Mnemonic, PublicKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { IKeyPair } from '../../main/shared/interfaces';

export const getStoredKeyPairs = (userId: string, secretHash?: string, secretHashName?: string) =>
  window.electronAPI.keyPairs.getStored(userId, secretHash, secretHashName);

export const getStoredKeysSecretHashes = (userId: string) =>
  window.electronAPI.keyPairs.getStoredKeysSecretHashes(userId);

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

  const privateKey =
    type === 'ED25519'
      ? mnemonic.toStandardEd25519PrivateKey(passphrase, keyIndex)
      : mnemonic.toStandardECDSAsecp256k1PrivateKey(passphrase, keyIndex);

  return privateKey;
};

export const storeKeyPair = (
  userId: string,
  password: string,
  secretHash: string,
  keyPair: IKeyPair,
) => window.electronAPI.keyPairs.store(userId, password, secretHash, keyPair);

export const changeDecryptionPassword = (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => window.electronAPI.keyPairs.changeDecryptionPassword(userId, oldPassword, newPassword);

export const decryptPrivateKey = async (userId: string, password: string, publicKey: string) => {
  try {
    return await window.electronAPI.keyPairs.decryptPrivateKey(userId, password, publicKey);
  } catch (error) {
    throw new Error('Failed to decrypt private key/s');
  }
};

export const hashRecoveryPhrase = (words: string[]) =>
  window.electronAPI.utils.hash(words.toString());

export const getAccountId = async (mirrorNodeURL: string, publicKey: string) => {
  try {
    const { data } = await axios.get(`${mirrorNodeURL}/accounts/?account.publickey=${publicKey}`);
    if (data.accounts.length > 0) {
      return data.accounts[0].account;
    }
  } catch (error) {
    console.log(error);
  }
};

export const clearKeys = (userId: string) => window.electronAPI.keyPairs.clear(userId);

export const deleteEncryptedPrivateKeys = (userId: string) =>
  window.electronAPI.keyPairs.deleteEncryptedPrivateKeys(userId);

export const validateMnemonic = async (words: string[]) => {
  try {
    await Mnemonic.fromWords(words);
    return true;
  } catch (error) {
    return false;
  }
};

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
