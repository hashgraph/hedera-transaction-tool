import { getMessageFromIPCError } from '../utils';

export const getAll = (userId: string) => window.electronAPI.accounts.getAll(userId);

export const add = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.add(userId, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account link failed'));
  }
};

export const remove = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.remove(userId, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account unlink failed'));
  }
};
