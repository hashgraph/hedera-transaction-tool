export const getAll = (email: string) => window.electronAPI.accounts.getAll(email);
export const add = async (email: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.add(email, accountId, nickname);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Account link failed';
    throw Error(message);
  }
};
export const remove = async (email: string, accountId: string, nickname: string = '') => {
  try {
    return await window.electronAPI.accounts.remove(email, accountId, nickname);
  } catch (err: any) {
    const message = err.message?.split(': Error: ')[1] || 'Account unlink failed';
    throw Error(message);
  }
};
