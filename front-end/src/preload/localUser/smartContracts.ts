import type { SmartContract } from '@prisma/client';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  smartContracts: {
    getAll: (findArgs: Prisma.SmartContractFindManyArgs): Promise<SmartContract[]> =>
      ipcRenderer.invoke('smartContracts:getAll', findArgs),
    getOne: (userId: string, id: string): Promise<SmartContract | null> =>
      ipcRenderer.invoke('smartContracts:getOne', userId, id),
    add: (contract: Prisma.SmartContractUncheckedCreateInput): Promise<SmartContract[]> =>
      ipcRenderer.invoke('smartContracts:add', contract),
    update: (
      id: string,
      userId: string,
      contract: Prisma.SmartContractUncheckedUpdateInput,
    ): Promise<SmartContract[]> => ipcRenderer.invoke('smartContracts:update', id, userId, contract),
    remove: (userId: string, ids: string[]): Promise<void> =>
      ipcRenderer.invoke('smartContracts:remove', userId, ids),
  },
};
