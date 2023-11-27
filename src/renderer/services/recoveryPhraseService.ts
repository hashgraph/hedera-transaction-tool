/* Recovery Phrase */

export const generatePhrase = async () => {
  const phrase = await window.electronAPI.recoveryPhrase.generate();
  return phrase;
};

export const downloadFileUnencrypted = async (words: string[]) => {
  window.electronAPI.recoveryPhrase.downloadFileUnencrypted(JSON.stringify(words));
};
