import { ipcRenderer } from 'electron';

import { HederaAccount } from '@prisma/client';

export default {
  accounts: {
    getAll: (userId: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:getAll', userId),
    add: (userId: string, accountId: string, nickname: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:add', userId, accountId, nickname),
    remove: (userId: string, accountId: string, nickname: string): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:remove', userId, accountId, nickname),
    changeNickname: (
      userId: string,
      accountId: string,
      nickname: string,
    ): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:changeNickname', userId, accountId, nickname),
  },
};
