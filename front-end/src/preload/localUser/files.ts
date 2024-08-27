import { ipcRenderer } from 'electron';

import { HederaFile, Prisma } from '@prisma/client';

import { HederaSpecialFileId } from '@main/shared/interfaces';

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
    showContentInTemp: (userId: string, fileId: string): Promise<void> =>
      ipcRenderer.invoke('files:showContentInTemp', userId, fileId),
    decodeProto: (fileId: HederaSpecialFileId, bytes: Uint8Array): Promise<string | undefined> =>
      ipcRenderer.invoke('files:decodeProto', fileId, bytes),
  },
};
