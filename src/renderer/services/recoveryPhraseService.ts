/* Recovery Phrase */

export const generatePhrase = () => window.electronAPI.recoveryPhrase.generate();

export const downloadFileUnencrypted = (words: string[]) => {
  window.electronAPI.recoveryPhrase.downloadFileUnencrypted([...words]);
};

export const encryptPassphrase = (recoveryPhrase: string[]) =>
  window.electronAPI.recoveryPhrase.encryptRecoveryPhrase([...recoveryPhrase]);

export const decryptPassphrase = () => window.electronAPI.recoveryPhrase.decryptRecoveryPhrase();
