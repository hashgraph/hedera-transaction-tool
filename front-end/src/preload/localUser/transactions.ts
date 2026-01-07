import type { Transaction } from '@prisma/client';

import { ipcRenderer } from 'electron';

import { Prisma } from '@prisma/client';

export default {
  transactions: {
    setClient: (mirrorNetwork: string | string[], ledgerId?: string) =>
      ipcRenderer.invoke('transactions:setClient', mirrorNetwork, ledgerId),
    freezeTransaction: (transactionBytes: Uint8Array): Promise<Uint8Array> =>
      ipcRenderer.invoke('transactions:freezeTransaction', transactionBytes),
    signTransaction: (
      transactionBytes: Uint8Array,
      publicKeys: string[],
      userId: string,
      userPassword: string | null,
      needsFreeze: boolean
    ): Promise<Uint8Array> =>
      ipcRenderer.invoke(
        'transactions:signTransaction',
        transactionBytes,
        publicKeys,
        userId,
        userPassword,
        needsFreeze
      ),
    executeTransaction: (
      transactionBytes: Uint8Array,
    ): Promise<{ responseJSON: string; receiptBytes: Uint8Array }> =>
      ipcRenderer.invoke('transactions:executeTransaction', transactionBytes),
    executeQuery: (
      queryBytes: Uint8Array,
      accountId: string,
      privateKey: string,
      privateKeyType: string,
    ) =>
      ipcRenderer.invoke(
        'transactions:executeQuery',
        queryBytes,
        accountId,
        privateKey,
        privateKeyType,
      ),
    storeTransaction: (transaction: Prisma.TransactionUncheckedCreateInput): Promise<Transaction> =>
      ipcRenderer.invoke('transactions:storeTransaction', transaction),
    getTransactions: (findArgs: Prisma.TransactionFindManyArgs): Promise<Transaction[]> =>
      ipcRenderer.invoke('transactions:getTransactions', findArgs),
    getTransaction: (id: string): Promise<Transaction> =>
      ipcRenderer.invoke('transactions:getTransaction', id),
    getTransactionsCount: (userId: string): Promise<number> =>
      ipcRenderer.invoke('transactions:getTransactionsCount', userId),
    encodeSpecialFile: (content: Uint8Array, fileId: string) =>
      ipcRenderer.invoke('transactions:encodeSpecialFile', content, fileId),
  },
};
