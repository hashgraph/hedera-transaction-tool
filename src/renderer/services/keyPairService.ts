import axios from 'axios';

import { Mnemonic } from '@hashgraph/sdk';

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
