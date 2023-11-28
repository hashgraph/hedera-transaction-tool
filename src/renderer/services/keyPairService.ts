export const getStoredKeyPairs = () => window.electronAPI.keyPairs.getStored();
export const generateKeyPair = (passphrase: string, index: number) =>
  window.electronAPI.keyPairs.generate(passphrase, index);
