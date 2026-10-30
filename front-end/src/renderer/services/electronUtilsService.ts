import type { FileFilter, OpenDialogReturnValue } from 'electron';

import { commonIPCHandler } from '@renderer/utils';

/* Set dock bounce */
export const setDockBounce = (bounce: boolean = true) =>
  window.electronAPI.local.utils.setDockBounce(bounce);

/* Open external URL */
export const openExternal = (url: string) => window.electronAPI.local.utils.openExternal(url);

/* Hash data */
export const hashData = async (data: string, pseudoSalt: boolean = false) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.hash(data, pseudoSalt);
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
export const saveFile = async (data: Uint8Array) => {
  try {
    await window.electronAPI.local.utils.saveFile(data.join(','));
  } catch {
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
  } catch {
    throw new Error('Failed to open the dialog');
  }
};

export const exportFilesWithDialog = async (
  files: Array<{ data: Uint8Array | string; extension?: string }>,
  name: string,
  title: string,
  buttonLabel: string,
  filters: FileFilter[],
  message: string,
): Promise<boolean> => {
  try {
    return await window.electronAPI.local.utils.exportFilesWithDialog(files, name, title, buttonLabel, filters, message);
  } catch {
    throw new Error('Failed to export file');
  }
};

export async function sha384(str: string): Promise<string> {
  return commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.sha384(str);
  }, 'Failed to hash');
}

/* get public key from PEM */
export async function x509BytesFromPem(pem: string | Uint8Array) {
  try {
    return await window.electronAPI.local.utils.x509BytesFromPem(pem);
  } catch {
    throw new Error('Error parsing the certificate');
  }
}

/* Quits the application */
export const quit = async () =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.quit();
  }, 'Failed quit the application');

/* Relaunches the application */
export const relaunch = async () =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.utils.relaunch();
  }, 'Failed to relaunch the application');
