export const getAll = (userId: string) => window.electronAPI.accounts.getAll(userId);
export const add = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.add(userId, accountId, nickname);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Account link failed';
    throw Error(message);
  }
};
export const remove = async (userId: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.remove(userId, accountId, nickname);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Account unlink failed';
    throw Error(message);
  }
};
