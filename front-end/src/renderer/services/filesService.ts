import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';

export const getAll = async (findArgs: Prisma.HederaFileFindManyArgs) => {
  try {
    return await window.electronAPI.local.files.getAll(findArgs);
  } catch {
    return [];
  }
};

export const add = async (file: Prisma.HederaFileUncheckedCreateInput) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.files.add(file);
  }, 'File link failed');

export const update = async (
  fileId: string,
  userId: string,
  file: Prisma.HederaFileUncheckedUpdateInput,
) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.files.update(fileId, userId, file);
  }, 'File update failed');

export const remove = async (userId: string, fileIds: string[]) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.files.remove(userId, fileIds);
  }, 'File unlink failed');

export const showStoredFileInTemp = async (userId: string, fileId: string) =>
  commonIPCHandler(async () => {
    await window.electronAPI.local.files.showStoredFileInTemp(userId, fileId);
  }, 'Failed to open file');
