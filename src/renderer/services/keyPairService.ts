import { PrivateKey } from '@hashgraph/sdk';

const getStoredPrivateKeys = () => window.electronAPI.privateKey.getStored();

const generatePrivateKey = (passphrase: string, index: number) =>
  window.electronAPI.privateKey.generate(passphrase, index);

export const getStoredKeyPairs = async () => {
  try {
    const privateKeys = await getStoredPrivateKeys();

    return privateKeys
      .map(pk => PrivateKey.fromStringED25519(pk))
      .map(pk => ({
        privateKey: pk.toStringRaw(),
        publicKey: pk.publicKey.toStringRaw(),
      }));
  } catch (error) {
    return [];
  }
};

export const generateKeyPair = async (passphrase: string, index: number) => {
  const privateKey = await generatePrivateKey(passphrase, index);
  const parsedPrivateKey = PrivateKey.fromStringED25519(privateKey);

  return {
    privateKey: privateKey,
    publicKey: parsedPrivateKey.publicKey.toStringRaw(),
  };
};
