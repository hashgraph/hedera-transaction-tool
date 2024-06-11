import { Prisma } from '@prisma/client';
import { getDrafts } from '@renderer/services/transactionDraftsService';
import {
  addGroup,
  addGroupWithDrafts,
  deleteGroup,
  getGroup,
  getGroupItems,
} from '@renderer/services/transactionGroupsService';
import { getTransactionFromBytes, getTransactionPayerId } from '@renderer/utils/transactions';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface GroupItem {
  transactionBytes: Uint8Array;
  type: string;
  accountId: string;
  seq: string;
  groupId?: string;
}

const useTransactionGroupStore = defineStore('transactionGroup', () => {
  /* State */
  const groupItems = ref<GroupItem[]>([]);
  const description = ref('');

  /* Actions */
  async function fetchGroup(id: string, findArgs: Prisma.TransactionDraftFindManyArgs) {
    groupItems.value = [];
    const group = await getGroup(id);
    description.value = group.description;
    const items = await getGroupItems(id);
    const drafts = await getDrafts(findArgs);
    for (const item of items) {
      const draft = drafts.find(draft => draft.id == item.transaction_draft_id);
      if (draft?.transactionBytes) {
        const transaction = getTransactionFromBytes(draft.transactionBytes);
        groupItems.value.push({
          transactionBytes: transaction.toBytes(),
          type: draft?.type,
          // accountId: transaction.transactionId!.accountId!.toString(),
          accountId: '',
          groupId: id,
          seq: item.seq,
        });
      }
    }
  }

  function clearGroup() {
    groupItems.value = [];
  }

  function addGroupItem(groupItem: GroupItem) {
    groupItems.value.push(groupItem);
  }

  function removeGroupItem(index: number) {
    groupItems.value.splice(index, 1);
  }

  function duplicateGroupItem(index: number) {
    const newGroupItems = new Array<GroupItem>();
    groupItems.value.forEach((groupItem, i) => {
      if (i == index + 1) {
        newGroupItems.push(groupItems.value[index]);
      }
      newGroupItems.push(groupItem);
    });
    groupItems.value = newGroupItems;
  }

  async function saveGroup(userId: string, description: string) {
    // Alter this when we know what 'atomic' does
    const groupId = await addGroupWithDrafts(userId, description, false, groupItems.value);
    const items = await getGroupItems(groupId!);
    for (const [index, groupItem] of groupItems.value.entries()) {
      groupItem.groupId = groupId;
      groupItem.seq = items[index].seq;
    }
  }

  return {
    fetchGroup,
    addGroupItem,
    removeGroupItem,
    duplicateGroupItem,
    saveGroup,
    clearGroup,
    groupItems,
  };
});

export default useTransactionGroupStore;
