import {Prisma} from '@prisma/client';
import {getMessageFromIPCError} from '@renderer/utils';

export const getAll = async (userId: string) => {
  try {
    return await window.electronAPI.files.getAll(userId);
  } catch (error) {
    return [];
  }
};

export const add = async (file: Prisma.HederaFileUncheckedCreateInput) => {
  try {
    return await window.electronAPI.files.add(file);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'File link failed'));
  }
};

export const update = async (
  fileId: string,
  userId: string,
  file: Prisma.HederaFileUncheckedUpdateInput,
) => {
  try {
    return await window.electronAPI.files.update(fileId, userId, file);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'File update failed'));
  }
};

export const remove = async (userId: string, fileId: string) => {
  try {
    return await window.electronAPI.files.remove(userId, fileId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'File unlink failed'));
  }
};

export const showContentInTemp = async (userId: string, fileId: string) => {
  try {
    await window.electronAPI.files.showContentInTemp(userId, fileId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to open file'));
  }
};
