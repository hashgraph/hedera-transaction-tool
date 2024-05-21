import { ipcRenderer } from 'electron';

import { HederaAccount, Prisma } from '@prisma/client';

import { Network } from '@main/shared/enums';

export default {
  accounts: {
    getAll: (findArgs: Prisma.HederaAccountFindManyArgs): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:getAll', findArgs),
    add: (
      userId: string,
      accountId: string,
      network: Network,
      nickname: string,
    ): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:add', userId, accountId, network, nickname),
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
