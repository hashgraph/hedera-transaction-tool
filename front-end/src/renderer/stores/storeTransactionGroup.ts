import { Key, KeyList, PublicKey } from '@hashgraph/sdk';
import { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';
import { Prisma } from '@prisma/client';
import { getDrafts } from '@renderer/services/transactionDraftsService';
import {
  addGroupWithDrafts,
  getGroup,
  getGroupItems,
} from '@renderer/services/transactionGroupsService';
import { getTransactionFromBytes } from '@renderer/utils/transactions';
import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface GroupItem {
  transactionBytes: Uint8Array;
  type: string;
  accountId: string;
  seq: string;
  groupId?: string;
  keyList: string[];
  observers: number[];
  approvers: TransactionApproverDto[];
}

const useTransactionGroupStore = defineStore('transactionGroup', () => {
  /* State */
  const groupItems = ref<GroupItem[]>([]);
  const description = ref('');

  // TODO: keylists, approvers and observers must be saved in local drafts
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
          keyList: [],
          observers: [],
          approvers: [],
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

  function editGroupItem(newGroupItem: GroupItem) {
    for (const [i] of groupItems.value.entries()) {
      if (i == Number.parseInt(newGroupItem.seq)) {
        groupItems.value[i] = newGroupItem;
      }
    }
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

  function getRequiredKeys() {
    const keys = new Array<string>();
    for (const groupItem of groupItems.value) {
      keys.concat(groupItem.keyList);
    }
    const keySet = new Set(keys);
    const returningKeys = new Array<Key>();
    for (const key of Array.from(keySet)) {
      returningKeys.push(PublicKey.fromString(key));
    }
    return KeyList.from(returningKeys);
  }

  // function getObservers() {
  //   const observers = new Array<number>();
  //   for (const groupItem of groupItems.value) {
  //     observers.concat(groupItem.observers);
  //   }
  //   const observerSet = new Set(observers);
  //   return Array.from(observerSet);
  // }

  // function getApprovers() {
  //   console.log('TODO');
  //   return new Array<TransactionApproverDto>();
  // }

  return {
    fetchGroup,
    addGroupItem,
    removeGroupItem,
    duplicateGroupItem,
    saveGroup,
    clearGroup,
    groupItems,
    description,
    getRequiredKeys,
    editGroupItem,
  };
});

export default useTransactionGroupStore;
