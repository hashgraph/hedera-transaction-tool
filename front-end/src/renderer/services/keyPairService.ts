import { Key, KeyList, Mnemonic, PrivateKey, PublicKey } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { Prisma } from '@prisma/client';

import { getMessageFromIPCError } from '@renderer/utils';

/* Key Pairs Service */

/* Get stored key pairs */
export const getKeyPairs = async (userId: string, organizationId?: string) => {
  try {
    return await window.electronAPI.keyPairs.getAll(userId, organizationId);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch key pairs'));
  }
};

/* Get stored secret hashes */
export const getSecretHashes = async (userId: string, organizationId?: string) => {
  try {
    return await window.electronAPI.keyPairs.getSecretHashes(userId, organizationId);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch secret hashes'));
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

/* Store key pair*/
export const storeKeyPair = async (
  keyPair: Prisma.KeyPairUncheckedCreateInput,
  password: string,
) => {
  try {
    return await window.electronAPI.keyPairs.store(keyPair, password);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to store key pair'));
  }
};

/* Change the decryption password of a stored private key */
export const changeDecryptionPassword = async (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => {
  try {
    return await window.electronAPI.keyPairs.changeDecryptionPassword(
      userId,
      oldPassword,
      newPassword,
    );
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to change decryption password'));
  }
};

/* Decrypt private key with user's password */
export const decryptPrivateKey = async (userId: string, password: string, publicKey: string) => {
  try {
    return await window.electronAPI.keyPairs.decryptPrivateKey(userId, password, publicKey);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to decrypt private key/s'));
  }
};

/* Hash recovery phrase */
export const hashRecoveryPhrase = async (words: string[]) => {
  try {
    return await window.electronAPI.utils.hash(words.toString());
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to hash recovery phrase'));
  }
};

/* Delete all stored key pairs */
export const clearKeys = async (userId: string, organizationId?: string) => {
  try {
    return await window.electronAPI.keyPairs.clear(userId, organizationId);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to clear key pairs'));
  }
};

/* Delete the encrypted private keys from user's key pairs */
export const deleteEncryptedPrivateKeys = async (userId: string, organizationId: string) => {
  try {
    return await window.electronAPI.keyPairs.deleteEncryptedPrivateKeys(userId, organizationId);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to delete encrypted private keys'));
  }
};

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
  try {
    return await window.electronAPI.keyPairs.deleteKeyPair(keyPairId);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to delete keys pair'));
  }
};

/* Flattens a key list to public keys*/
export const flattenKeyList = (keyList: Key): PublicKey[] => {
  const protobufKey = keyList._toProtobufKey();

  const keys: PublicKey[] = [];
  const keysString: string[] = [];

  formatKey(protobufKey);

  function formatKey(key: proto.Key) {
    if (key.thresholdKey) {
      key.thresholdKey.keys?.keys?.forEach((key: proto.Key) => {
        formatKey(key);
      });
    } else if (key.keyList) {
      key.keyList.keys?.forEach((k: proto.Key) => {
        formatKey(k);
      });
    } else {
      let publicKey: PublicKey;

      if (key.ed25519) {
        publicKey = PublicKey.fromBytesED25519(key.ed25519);
      } else if (key.ECDSASecp256k1) {
        publicKey = PublicKey.fromBytesECDSA(key.ECDSASecp256k1);
      } else {
        throw new Error('Unsupported key type');
      }

      if (publicKey && !keysString.includes(publicKey.toStringRaw())) {
        keys.push(publicKey);
        keysString.push(publicKey.toStringRaw());
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
