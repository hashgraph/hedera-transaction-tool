/* Recovery Phrase */
export const downloadFileUnencrypted = (words: string[]) => {
  window.electronAPI.recoveryPhrase.downloadFileUnencrypted([...words]);
};
