/* Recovery Phrase */

export const generatePhrase = async () => {
  const phrase = await window.electronAPI.recoveryPhrase.generate();
  return phrase;
};
