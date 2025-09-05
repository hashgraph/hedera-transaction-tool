import { Prisma } from '@prisma/client';

import { commonIPCHandler } from '@renderer/utils';
import { getTransactionType } from '../utils/sdk/transactions';

/* Transaction Drafts Service */

/* Get raw drafts */
export const getDrafts = async (findArgs: Prisma.TransactionDraftFindManyArgs) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactionDrafts.getDrafts(findArgs);
  }, 'Failed to fetch transaction drafts');

export const getDraft = async (id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactionDrafts.getDraft(id);
  }, `Failed to fetch transaction with id: ${id}`);

export const addDraft = async (
  userId: string,
  transactionBytes: Uint8Array,
  description: string,
  details?: string,
) => {
  const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
    created_at: new Date(),
    updated_at: new Date(),
    user_id: userId,
    transactionBytes: transactionBytes.toString(),
    type: getTransactionType(transactionBytes),
    description: description || '',
    details: details || null,
  };

  return await commonIPCHandler(async () => {
    return await window.electronAPI.local.transactionDrafts.addDraft(transactionDraft);
  }, 'Failed to add transaction draft');
};

export const updateDraft = async (id: string, draft: Prisma.TransactionDraftUncheckedUpdateInput) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactionDrafts.updateDraft(id, draft);
  }, `Failed to fetch transaction with id: ${draft.id}`);

export const deleteDraft = async (id: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactionDrafts.deleteDraft(id);
  }, `Failed to delete transaction with id: ${id}`);

export const draftExists = async (transactionBytes: Uint8Array) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactionDrafts.draftExists(
      transactionBytes.toString(),
    );
  }, `Failed to determine if transaction draft exist`);

/* Returns saved drafts count */
export const getDraftsCount = async (userId: string) =>
  commonIPCHandler(async () => {
    return await window.electronAPI.local.transactionDrafts.getDraftsCount(userId);
  }, 'Failed to get transactions count');
