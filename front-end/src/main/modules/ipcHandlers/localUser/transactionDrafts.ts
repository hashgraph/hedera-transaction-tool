import { ipcMain } from 'electron';

import { Prisma } from '@prisma/client';

import {
  addDraft,
  deleteDraft,
  draftExists,
  getDraft,
  getDrafts,
  getDraftsCount,
  updateDraft,
} from '@main/services/localUser';

const createChannelName = (...props) => ['transactionDrafts', ...props].join(':');

export default () => {
  /* Transaction drafts */

  // Get all drafts
  ipcMain.handle(
    createChannelName('getDrafts'),
    (_e, findArgs: Prisma.TransactionDraftFindManyArgs) => getDrafts(findArgs),
  );

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
    (_e, id: string, transactionDraft: Prisma.TransactionDraftUncheckedUpdateInput) =>
      updateDraft(id, transactionDraft),
  );

  // Delete specific drafts
  ipcMain.handle(createChannelName('deleteDraft'), (_e, id: string) => deleteDraft(id));

  // Returns whether a draft with such transaction exists
  ipcMain.handle(createChannelName('draftExists'), (_e, transactionBytes: string) =>
    draftExists(transactionBytes),
  );

  // Get drafts count
  ipcMain.handle(createChannelName('getDraftsCount'), (_e, userId: string) =>
    getDraftsCount(userId),
  );
};
