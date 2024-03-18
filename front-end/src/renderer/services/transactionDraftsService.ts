import { Prisma } from '@prisma/client';

import { getMessageFromIPCError } from '@renderer/utils';
import { getTransactionType } from '@renderer/utils/transactions';

/* Transaction Drafts Service */

/* Get raw drafts */
export const getDrafts = async (findArgs: Prisma.TransactionDraftFindManyArgs) => {
  try {
    return await window.electronAPI.transactionDrafts.getDrafts(findArgs);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch transaction drafts'));
  }
};

export const getDraft = async (id: string) => {
  try {
    return await window.electronAPI.transactionDrafts.getDraft(id);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to fetch transaction with id: ${id}`));
  }
};

export const addDraft = async (userId: string, transactionBytes: Uint8Array, details?: string) => {
  const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
    created_at: new Date(),
    updated_at: new Date(),
    user_id: userId,
    transactionBytes: transactionBytes.toString(),
    type: getTransactionType(transactionBytes),
    details: details || null,
  };

  try {
    return await window.electronAPI.transactionDrafts.addDraft(transactionDraft);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to add transaction draft'));
  }
};

export const updateDraft = async (
  id: string,
  draft: Prisma.TransactionDraftUncheckedUpdateInput,
) => {
  try {
    return await window.electronAPI.transactionDrafts.updateDraft(id, draft);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to fetch transaction with id: ${draft.id}`));
  }
};

export const deleteDraft = async (id: string) => {
  try {
    return await window.electronAPI.transactionDrafts.deleteDraft(id);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to delete transaction with id: ${id}`));
  }
};

export const draftExists = async (transactionBytes: Uint8Array) => {
  try {
    return await window.electronAPI.transactionDrafts.draftExists(transactionBytes.toString());
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to determine if transaction draft exist`));
  }
};

/* Returns saved drafts count */
export const getDraftsCount = async (userId: string) => {
  try {
    return await window.electronAPI.transactionDrafts.getDraftsCount(userId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get transactions count'));
  }
};
