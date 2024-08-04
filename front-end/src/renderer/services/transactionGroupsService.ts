import { Prisma, GroupItem } from '@prisma/client';
import { GroupItem as StoreGroupItem } from '@renderer/stores/storeTransactionGroup';

import { getMessageFromIPCError } from '@renderer/utils';
import { getTransactionType } from '@renderer/utils/transactions';

/* Transaction Groups Service */

/* Get groups */
export const getGroups = async (findArgs: Prisma.TransactionGroupFindManyArgs) => {
  try {
    return await window.electronAPI.local.transactionGroups.getGroups(findArgs);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to fetch transaction groups'));
  }
};

export const getGroup = async (id: string) => {
  try {
    return await window.electronAPI.local.transactionGroups.getGroup(id);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to fetch transaction group with id: ${id}`));
  }
};

export async function getGroupItems(id: string) {
  try {
    return await window.electronAPI.local.transactionGroups.getGroupItems(id);
  } catch (error: any) {
    throw Error(
      getMessageFromIPCError(error, `Failed to fetch transaction group items with id: ${id}`),
    );
  }
}

export async function getGroupItem(id: string, seq: string) {
  try {
    return await window.electronAPI.local.transactionGroups.getGroupItem(id, seq);
  } catch (error: any) {
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
  details?: string,
) => {
  const group = await addGroup(description, atomic);
  try {
    for (const [index, item] of groupItems.entries()) {
      const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
        created_at: new Date(),
        updated_at: new Date(),
        user_id: userId,
        transactionBytes: item.transactionBytes.toString(),
        type: getTransactionType(item.transactionBytes),
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
  } catch (error: any) {
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
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, 'Failed to add groupItem'));
  }
}

export async function addGroup(description: string, atomic: boolean) {
  const transactionGroup: Prisma.TransactionGroupUncheckedCreateInput = {
    description,
    // Not sure how this should be entered or what it's for
    atomic: atomic,
    created_at: new Date(),
  };
  try {
    return await window.electronAPI.local.transactionGroups.addGroup(transactionGroup);
  } catch (error: any) {
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
    for (const [index, item] of groupItems.entries()) {
      const transactionDraft: Prisma.TransactionDraftUncheckedUpdateInput = {
        created_at: new Date(),
        updated_at: new Date(),
        user_id: userId,
        transactionBytes: item.transactionBytes.toString(),
        type: getTransactionType(item.transactionBytes),
      };
      if (item.groupId) {
        const savedItem = await getGroupItem(id, index.toString());
        await window.electronAPI.local.transactionDrafts.updateDraft(
          savedItem.transaction_draft_id!,
          transactionDraft,
        );
      } else {
        const transactionDraft: Prisma.TransactionDraftUncheckedCreateInput = {
          created_at: new Date(),
          updated_at: new Date(),
          user_id: userId,
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
    }
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to fetch transaction group with id: ${id}`));
  }
}

export const deleteGroup = async (id: string) => {
  try {
    return await window.electronAPI.local.transactionGroups.deleteGroup(id);
  } catch (error: any) {
    throw Error(getMessageFromIPCError(error, `Failed to delete transaction group with id: ${id}`));
  }
};

// export const draftExists = async (transactionBytes: Uint8Array) => {
//   try {
//     return await window.electronAPI.local.transactionDrafts.draftExists(
//       transactionBytes.toString(),
//     );
//   } catch (error: any) {
//     throw Error(getMessageFromIPCError(error, `Failed to determine if transaction draft exist`));
//   }
// };

/* Returns saved drafts count */
export const getGroupsCount = async (userId: string) => {
  try {
    return await window.electronAPI.local.transactionGroups.getGroupsCount(userId);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to get transactions count'));
  }
};

export async function editGroupItem(groupItem: GroupItem) {
  try {
    return await window.electronAPI.local.transactionGroups.editGroupItem(groupItem);
  } catch (err: any) {
    throw Error(getMessageFromIPCError(err, 'Failed to update group item'));
  }
}
