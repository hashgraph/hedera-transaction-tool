import type { GroupItem as StoreGroupItem } from '@renderer/stores/storeTransactionGroup';
import type { GroupItem } from '@prisma/client';

import { Prisma } from '@prisma/client';

import { getMessageFromIPCError } from '@renderer/utils';

import { deleteDraft } from './transactionDraftsService';
import { getTransactionType } from '../utils/sdk/transactions';

/* Transaction Groups Service */

/* Get groups */
export const getGroups = async (findArgs: Prisma.TransactionGroupFindManyArgs) => {
  try {
    return await window.electronAPI.local.transactionGroups.getGroups(findArgs);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch transaction groups'));
  }
};

export const getGroup = async (id: string) => {
  try {
    return await window.electronAPI.local.transactionGroups.getGroup(id);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, `Failed to fetch transaction group with id: ${id}`));
  }
};

export async function getGroupItems(id: string) {
  try {
    return await window.electronAPI.local.transactionGroups.getGroupItems(id);
  } catch (error) {
    throw Error(
      getMessageFromIPCError(error, `Failed to fetch transaction group items with id: ${id}`),
    );
  }
}

export async function getGroupItem(id: string, seq: string) {
  try {
    return await window.electronAPI.local.transactionGroups.getGroupItem(id, seq);
  } catch (error) {
    throw Error(
      getMessageFromIPCError(error, `Failed to fetch transaction group items with id: ${id}`),
    );
  }
}

export const addGroupWithDrafts = async (
  userId: string,
  description: string,
  atomic: boolean,
  groupItems: StoreGroupItem[],
  groupValidStart: Date,
  details?: string,
) => {
  const group = await addGroup(description, atomic, groupValidStart);
  try {
    for (const [index, item] of groupItems.entries()) {
      const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
        created_at: new Date(),
        updated_at: new Date(),
        user_id: userId,
        transactionBytes: item.transactionBytes.toString(),
        type: getTransactionType(item.transactionBytes),
        description: item.description,
        details: details || null,
      };
      const draft = await window.electronAPI.local.transactionDrafts.addDraft(transactionDraft);
      const groupItem: Prisma.GroupItemUncheckedCreateInput = {
        transaction_draft_id: draft.id,
        transaction_group_id: group.id,
        seq: index.toString(),
      };
      await window.electronAPI.local.transactionGroups.addGroupItem(groupItem);
    }
    return group.id;
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to add transaction draft'));
  }
};

export async function addGroupItem(
  groupItem: StoreGroupItem,
  groupId: string,
  txId: string | null,
) {
  const groupItemStruct: Prisma.GroupItemUncheckedCreateInput = {
    transaction_id: txId,
    transaction_group_id: groupId,
    seq: groupItem.seq,
  };
  try {
    await window.electronAPI.local.transactionGroups.addGroupItem(groupItemStruct);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to add groupItem'));
  }
}

export async function addGroup(description: string, atomic: boolean, groupValidStart: Date) {
  const transactionGroup: Prisma.TransactionGroupUncheckedCreateInput = {
    description,
    // Not sure how this should be entered or what it's for
    atomic: atomic,
    created_at: new Date(),
    groupValidStart: groupValidStart,
  };
  try {
    return await window.electronAPI.local.transactionGroups.addGroup(transactionGroup);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to add transaction draft'));
  }
}

export async function updateGroup(
  id: string,
  userId: string,
  group: Prisma.TransactionGroupUncheckedUpdateInput,
  groupItems: StoreGroupItem[],
) {
  try {
    await window.electronAPI.local.transactionGroups.updateGroup(id, group);
    // The in-memory list is sorted by validStart with seq === array index, so
    // its positions no longer line up with the persisted rows once an item has
    // been inserted in the middle, reordered, or removed. Matching the two by
    // index deletes/updates the wrong draft (and then fails to find later ones),
    // so reconcile by replacing the whole set: drop every existing item and its
    // draft, then recreate from the current order with seq === index. A single
    // insert in the middle can shift the validStart of many following items at
    // once, so even matching by transaction_draft_id and updating in place would
    // mean rewriting most of the rows anyway — a full delete and recreate is
    // simpler and avoids the bookkeeping. Group items are small, so a full
    // rewrite is cheap and keeps the persisted order authoritative regardless of
    // how the items were edited.
    const fetchedItems = await window.electronAPI.local.transactionGroups.getGroupItems(id);
    for (const item of fetchedItems) {
      if (item.transaction_draft_id) {
        await deleteDraft(item.transaction_draft_id);
      }
      await window.electronAPI.local.transactionGroups.deleteGroupItem(id, item.seq);
    }

    for (const [index, item] of groupItems.entries()) {
      const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
        created_at: new Date(),
        updated_at: new Date(),
        user_id: userId,
        description: item.description,
        transactionBytes: item.transactionBytes.toString(),
        type: getTransactionType(item.transactionBytes),
      };
      const draft = await window.electronAPI.local.transactionDrafts.addDraft(transactionDraft);
      const groupItem: Prisma.GroupItemUncheckedCreateInput = {
        transaction_draft_id: draft.id,
        transaction_group_id: id,
        seq: index.toString(),
      };
      await window.electronAPI.local.transactionGroups.addGroupItem(groupItem);
    }
  } catch (error) {
    throw Error(getMessageFromIPCError(error, `Failed to fetch transaction group with id: ${id}`));
  }
}

export const deleteGroup = async (id: string) => {
  try {
    return await window.electronAPI.local.transactionGroups.deleteGroup(id);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, `Failed to delete transaction group with id: ${id}`));
  }
};

// export const draftExists = async (transactionBytes: Uint8Array) => {
//   try {
//     return await window.electronAPI.local.transactionDrafts.draftExists(
//       transactionBytes.toString(),
//     );
//   } catch (error) {
//     throw Error(getMessageFromIPCError(error, `Failed to determine if transaction draft exist`));
//   }
// };

/* Returns saved drafts count */
export const getGroupsCount = async (userId: string) => {
  try {
    return await window.electronAPI.local.transactionGroups.getGroupsCount(userId);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to get transactions count'));
  }
};

export async function editGroupItem(groupItem: GroupItem) {
  try {
    return await window.electronAPI.local.transactionGroups.editGroupItem(groupItem);
  } catch (error) {
    throw Error(getMessageFromIPCError(error, 'Failed to update group item'));
  }
}
