import axios from 'axios';

import { KeyList, Mnemonic, PublicKey } from '@hashgraph/sdk';

import { IKeyPair } from '../../main/shared/interfaces/IKeyPair';

export const getStoredKeyPairs = (userId: string) => window.electronAPI.keyPairs.getStored(userId);

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

export const storeKeyPair = (userId: string, password: string, keyPair: IKeyPair) =>
  window.electronAPI.keyPairs.store(userId, password, keyPair);

export const changeDecryptionPassword = (
  userId: string,
  oldPassword: string,
  newPassword: string,
) => window.electronAPI.keyPairs.changeDecryptionPassword(userId, oldPassword, newPassword);

export const decryptPrivateKey = (userId: string, password: string, publicKey: string) =>
  window.electronAPI.keyPairs.decryptPrivateKey(userId, password, publicKey);

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

// export const updateKeyList = (
//   keyList: KeyList,
//   path: number[],
//   publicKey?: string,
//   threshold?: number,
// ): KeyList => {
//   console.log(path);

//   const newKeyList = new KeyList([], threshold);

//   let tempKey: any = keyList.toArray();
//   let currentKey;
//   path.forEach(i => {
//     if (tempKey instanceof KeyList) {
//       tempKey = tempKey._keys[i];
//     } else {
//       tempKey = tempKey[i];
//     }
//     console.log(tempKey);
//   });

//   return newKeyList || keyList;
// };
