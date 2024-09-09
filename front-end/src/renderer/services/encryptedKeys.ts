export const searchEncryptedKeys = async (filePaths: string[]) => {
  try {
    return await window.electronAPI.local.encryptedKeys.searchEncryptedKeys(filePaths);
  } catch (error) {
    return [];
  }
};
