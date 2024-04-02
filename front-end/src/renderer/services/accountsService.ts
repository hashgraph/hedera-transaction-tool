import { getMessageFromIPCError } from '@renderer/utils';

export const getAll = async (userId: string) => {
  try {
    return await window.electronAPI.local.accounts.getAll(userId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get linked acccounts'));
  }
};

export const add = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.local.accounts.add(userId, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account link failed'));
  }
};

export const remove = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.local.accounts.remove(userId, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account unlink failed'));
  }
};

export const changeNickname = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.local.accounts.changeNickname(userId, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account nickname change failed'));
  }
};
