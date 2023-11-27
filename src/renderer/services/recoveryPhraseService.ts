/* Recovery Phrase */

export const generatePhrase = async () => {
  const phrase = await window.electronAPI.recoveryPhrase.generate();
  return phrase;
};

export const downloadFileUnencrypted = async (words: string[]) => {
  window.electronAPI.recoveryPhrase.downloadFileUnencrypted(JSON.stringify(words));
};

export const encryptPassphrase = async (recoveryPhrase: string[], passPhrase: string) =>
  window.electronAPI.recoveryPhrase.encryptRecoveryPhrase(
    JSON.stringify({
      recoveryPhrase,
      passPhrase,
    }),
  );
