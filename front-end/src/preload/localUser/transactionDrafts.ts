import { ipcRenderer } from 'electron';

import { Prisma, TransactionDraft } from '@prisma/client';

export default {
  transactionDrafts: {
    getDrafts: (findArgs: Prisma.TransactionDraftFindManyArgs): Promise<TransactionDraft[]> =>
      ipcRenderer.invoke('transactionDrafts:getDrafts', findArgs),
    getDraft: (id: string): Promise<TransactionDraft> =>
      ipcRenderer.invoke('transactionDrafts:getDraft', id),
    addDraft: (draft: Prisma.TransactionDraftUncheckedCreateInput): Promise<TransactionDraft> =>
      ipcRenderer.invoke('transactionDrafts:addDraft', draft),
    updateDraft: (id: string, draft: Prisma.TransactionDraftUncheckedUpdateInput): Promise<void> =>
      ipcRenderer.invoke('transactionDrafts:updateDraft', id, draft),
    deleteDraft: (id: string): Promise<void> =>
      ipcRenderer.invoke('transactionDrafts:deleteDraft', id),
    draftExists: (transactionBytes: string): Promise<boolean> =>
      ipcRenderer.invoke('transactionDrafts:draftExists', transactionBytes),
    getDraftsCount: (userId: string): Promise<number> =>
      ipcRenderer.invoke('transactionDrafts:getDraftsCount', userId),
  },
};
