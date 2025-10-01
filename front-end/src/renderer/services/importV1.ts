import { commonIPCHandler } from '@renderer/utils';

export const filterForImportV1 = async (filePaths: string[]) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.importV1.filterForImportV1(filePaths);
  }, 'Failed to filter files for V1 import');
