import type { Mnemonic } from '@prisma/client';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  mnemonic: {
    add: (userId: string, mnemonicHash: string, nickname: string): Promise<Mnemonic> =>
      ipcRenderer.invoke('mnemonic:add', userId, mnemonicHash, nickname),
    get: (findArgs: Prisma.MnemonicFindManyArgs): Promise<Mnemonic[]> =>
      ipcRenderer.invoke('mnemonic:get', findArgs),
    update: (userId: string, mnemonicHash: string, nickname: string): Promise<Mnemonic> =>
      ipcRenderer.invoke('mnemonic:update', userId, mnemonicHash, nickname),
    remove: (userId: string, mnemonicHash: string[]): Promise<boolean> =>
      ipcRenderer.invoke('mnemonic:remove', userId, mnemonicHash),
  },
};
