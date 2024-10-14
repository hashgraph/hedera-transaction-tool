import type { FileFilter, OpenDialogReturnValue } from 'electron';

import { commonIPCHandler } from '@renderer/utils';

/* Open external URL */
export const openExternal = (url: string) => window.electronAPI.local.utils.openExternal(url);

/* Hash data */
export const hashData = async (data: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.hash(data);
  }, 'Failed to hash data');

/* Compare hash */
export const compareHash = async (data: string, hash: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.compareHash(data, hash);
  }, 'Failed to compare data to hash');

/* Compare data to hashes */
export const compareDataToHashes = async (data: string, hashes: string[]) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.compareDataToHashes(data, hashes);
  }, 'Failed to compare data to hashes');

/* Opens a buffer in a temp file */
export const openBufferInTempFile = async (name: string, data: Uint8Array) => {
  try {
    await window.electronAPI.local.utils.openBufferInTempFile(name, data.join(','));
  } catch (error) {
    throw new Error('Failed to open the content in a temp file');
  }
};

/* Opens a buffer in a temp file */
export const saveFile = async (data: Uint8Array) => {
  try {
    await window.electronAPI.local.utils.saveFile(data.join(','));
  } catch (error) {
    throw new Error('Failed to save file');
  }
};

/* Opens an open dialog */
export const showOpenDialog = async (
  title: string,
  buttonLabel: string,
  filters: FileFilter[],
  properties: ('openFile' | 'openDirectory' | 'multiSelections')[],
  message: string,
): Promise<OpenDialogReturnValue> => {
  try {
    return await window.electronAPI.local.utils.showOpenDialog(
      title,
      buttonLabel,
      filters,
      properties,
      message,
    );
  } catch (error) {
    throw new Error('Failed to open the dialog');
  }
};

/* Quits the application */
export const quit = async () =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.quit();
  }, 'Failed quit the application');
