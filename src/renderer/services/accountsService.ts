import { getMessageFromIPCError } from '../utils';

export const getAll = (email: string) => window.electronAPI.accounts.getAll(email);
export const add = async (email: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.add(email, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account link failed'));
  }
};
export const remove = async (email: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.remove(email, accountId, nickname);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Account unlink failed'));
  }
};
