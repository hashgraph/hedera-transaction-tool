import type { HederaAccount } from '@prisma/client';
import type { Network } from '@shared/interfaces';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  accounts: {
    getAll: (findArgs: Prisma.HederaAccountFindManyArgs): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:getAll', findArgs),
    getOne: (userId: string, accountId: string): Promise<HederaAccount | null> =>
      ipcRenderer.invoke('accounts:getOne', userId, accountId),
    add: (
      userId: string,
      accountId: string,
      network: Network,
      nickname: string,
    ): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:add', userId, accountId, network, nickname),
    remove: (userId: string, accountIds: string[]): Promise<void> =>
      ipcRenderer.invoke('accounts:remove', userId, accountIds),
    changeNickname: (
      userId: string,
      accountId: string,
      nickname: string,
    ): Promise<HederaAccount[]> =>
      ipcRenderer.invoke('accounts:changeNickname', userId, accountId, nickname),
  },
};
