import { getMessageFromIPCError } from '@renderer/utils';

export const getAll = (userId: string) => window.electronAPI.files.getAll(userId);

export const add = async (userId: string, fileId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.files.add(userId, fileId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'File link failed'));
  }
};

export const remove = async (userId: string, fileId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.files.remove(userId, fileId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'File unlink failed'));
  }
};
