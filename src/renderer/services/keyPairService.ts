import { Mnemonic, PrivateKey } from '@hashgraph/sdk';

import axios from 'axios';

const getStoredPrivateKeys = () => window.electronAPI.privateKey.getStored();

export const generatePrivateKey = async (words: string[], passphrase: string, keyIndex: number) => {
  if (words.length !== 24) {
    throw Error('Invalod Recovery Phrase');
  }

  const mnemonic = await Mnemonic.fromWords(words);

  const privateKey = await mnemonic.toStandardEd25519PrivateKey(passphrase, keyIndex);

  return privateKey;
};

export const storePrivateKey = (privateKey: string, index: number) =>
  window.electronAPI.privateKey.store(privateKey, index);

export const getStoredKeyPairs = async () => {
  try {
    const privateKeys = await getStoredPrivateKeys();

    return privateKeys
      .map(pk => ({
        privateKey: PrivateKey.fromStringED25519(pk.privateKey),
        index: pk.index,
      }))
      .map(pk => ({
        privateKey: pk.privateKey.toStringRaw(),
        index: pk.index,
        publicKey: pk.privateKey.publicKey.toStringRaw(),
      }));
  } catch (error) {
    return [];
  }
};

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
