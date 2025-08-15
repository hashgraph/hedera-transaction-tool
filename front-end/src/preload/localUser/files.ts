import type { HederaFile } from '@prisma/client';
import type { HederaSpecialFileId } from '@shared/interfaces';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  files: {
    getAll: (findArgs: Prisma.HederaFileFindManyArgs): Promise<HederaFile[]> =>
      ipcRenderer.invoke('files:getAll', findArgs),
    add: (file: Prisma.HederaFileUncheckedCreateInput): Promise<HederaFile[]> =>
      ipcRenderer.invoke('files:add', file),
    update: (
      fileId: string,
      userId: string,
      file: Prisma.HederaFileUncheckedUpdateInput,
    ): Promise<HederaFile[]> => ipcRenderer.invoke('files:update', fileId, userId, file),
    remove: (userId: string, fileIds: string[]): Promise<HederaFile[]> =>
      ipcRenderer.invoke('files:remove', userId, fileIds),
    showStoredFileInTemp: (userId: string, fileId: string): Promise<void> =>
      ipcRenderer.invoke('files:showStoredFileInTemp', userId, fileId),
    decodeProto: (fileId: HederaSpecialFileId, bytes: Uint8Array): Promise<string | undefined> =>
      ipcRenderer.invoke('files:decodeProto', fileId, bytes),
  },
};
