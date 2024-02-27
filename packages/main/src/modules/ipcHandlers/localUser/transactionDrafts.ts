import {ipcMain} from 'electron';

import type {Prisma} from '@prisma/client';

import {
  addDraft,
  deleteDraft,
  draftExists,
  getDraft,
  getDrafts,
  updateDraft,
} from '@main/services/localUser';

const createChannelName = (...props: string[]) => ['transactionDrafts', ...props].join(':');

export default () => {
  /* Transaction drafts */

  // Get all drafts
  ipcMain.handle(createChannelName('getDrafts'), (_e, userId: string) => getDrafts(userId));

  // Get specific drafts
  ipcMain.handle(createChannelName('getDraft'), (_e, id: string) => getDraft(id));

  // Add a draft
  ipcMain.handle(
    createChannelName('addDraft'),
    (_e, transactionDraft: Prisma.TransactionDraftUncheckedCreateInput) =>
      addDraft(transactionDraft),
  );

  // Update a draft
  ipcMain.handle(
    createChannelName('updateDraft'),
    (_e, transactionDraft: Prisma.TransactionDraftUncheckedCreateInput) =>
      updateDraft(transactionDraft),
  );

  // Delete specific drafts
  ipcMain.handle(createChannelName('deleteDraft'), (_e, id: string) => deleteDraft(id));

  // Returns whether a draft with such transaction exists
  ipcMain.handle(createChannelName('draftExists'), (_e, transactionBytes: string) =>
    draftExists(transactionBytes),
  );
};
