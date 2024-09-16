import type { Claim } from '@prisma/client';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  claim: {
    add: (userId: string, claimKey: string, claimValue: string): Promise<Claim> =>
      ipcRenderer.invoke('claim:add', userId, claimKey, claimValue),
    get: (findArgs: Prisma.ClaimFindManyArgs): Promise<Claim[]> =>
      ipcRenderer.invoke('claim:get', findArgs),
    update: (userId: string, claimKey: string, claimValue: string): Promise<Claim> =>
      ipcRenderer.invoke('claim:update', userId, claimKey, claimValue),
    remove: (userId: string, claimKeys: string[]): Promise<boolean> =>
      ipcRenderer.invoke('claim:remove', userId, claimKeys),
  },
};
