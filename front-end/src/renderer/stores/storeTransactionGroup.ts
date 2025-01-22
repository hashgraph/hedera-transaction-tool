import type { TransactionApproverDto } from '@main/shared/interfaces/organization/approvers';

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { Key, KeyList, PublicKey, Transaction } from '@hashgraph/sdk';
import { Prisma } from '@prisma/client';

import { getDrafts } from '@renderer/services/transactionDraftsService';
import {
  addGroupWithDrafts,
  getGroup,
  getGroupItems,
  updateGroup,
} from '@renderer/services/transactionGroupsService';

import { getTransactionFromBytes } from '@renderer/utils';
import { createTransactionId } from '@renderer/utils/sdk';

export interface GroupItem {
  transactionBytes: Uint8Array;
  type: string;
  seq: string;
  groupId?: string;
  keyList: string[];
  observers: number[];
  approvers: TransactionApproverDto[];
  payerAccountId: string;
  validStart: Date;
  description: string;
}

const useTransactionGroupStore = defineStore('transactionGroup', () => {
  /* State */
  const groupItems = ref<GroupItem[]>([]);
  const groupValidStart = ref(new Date());
  const description = ref('');
  const sequential = ref(false);
  const modified = ref(false);

  // TODO: keylists, approvers and observers must be saved in local drafts
  /* Actions */
  async function fetchGroup(id: string, findArgs: Prisma.TransactionDraftFindManyArgs) {
    if (modified.value) {
      return;
    }

    groupItems.value = [];
    const group = await getGroup(id);
    description.value = group.description;
    if (group.groupValidStart) {
      if (group.groupValidStart > groupValidStart.value) {
        groupValidStart.value = group.groupValidStart;
      } else {
        groupValidStart.value = new Date();
      }
    }

    const items = await getGroupItems(id);
    const drafts = await getDrafts(findArgs);
    const groupItemsToAdd: GroupItem[] = [];

    for (const item of items) {
      const draft = drafts.find(draft => draft.id == item.transaction_draft_id);
      if (draft?.transactionBytes) {
        const transaction = getTransactionFromBytes(draft.transactionBytes);
        groupItemsToAdd.push({
          transactionBytes: transaction.toBytes(),
          type: draft?.type,
          groupId: id,
          seq: item.seq,
          keyList: [],
          observers: [],
          approvers: [],
          payerAccountId: transaction.transactionId?.accountId?.toString() as string,
          validStart: transaction.transactionId?.validStart?.toDate() as Date,
          description: draft.description,
        });
      }
    }

    groupItems.value = groupItemsToAdd;
  }

  function clearGroup() {
    groupItems.value = [];
    groupValidStart.value = new Date();
    description.value = '';
    sequential.value = false;
    modified.value = false;
  }

  function addGroupItem(groupItem: GroupItem) {
    groupItems.value = [...groupItems.value, groupItem];
    setModified();
  }

  function editGroupItem(newGroupItem: GroupItem) {
    for (const [i] of groupItems.value.entries()) {
      if (i == Number.parseInt(newGroupItem.seq)) {
        groupItems.value = [
          ...groupItems.value.slice(0, i),
          newGroupItem,
          ...groupItems.value.slice(i + 1),
        ];
      }
    }
    setModified();
  }

  function removeGroupItem(index: number) {
    groupItems.value = [...groupItems.value.slice(0, index), ...groupItems.value.slice(index + 1)];
    setModified();
  }

  /**
   * Duplicates a group item at the specified index.
   * The resulting transaction will be identical to the original,
   * except for the validStart date and seq number.
   * @param index
   */
  function duplicateGroupItem(index: number) {
    const lastItem = groupItems.value[groupItems.value.length - 1];
    const baseItem = groupItems.value[index];
    const newDate = findUniqueValidStart(
      baseItem.payerAccountId,
      baseItem.validStart.getTime() + 1,
    );
    const transaction = Transaction.fromBytes(baseItem.transactionBytes);
    transaction.setTransactionId(createTransactionId(baseItem.payerAccountId, newDate));
    const newItem = {
      transactionBytes: transaction.toBytes(),
      type: baseItem.type,
      description: baseItem.description,
      seq: (Number.parseInt(lastItem.seq) + 1).toString(),
      keyList: baseItem.keyList,
      observers: baseItem.observers,
      approvers: baseItem.approvers,
      payerAccountId: baseItem.payerAccountId,
      validStart: newDate,
    };

    groupItems.value = [...groupItems.value, newItem];
    setModified();
  }

  /**
   * Finds a unique validStart date for a group item.
   * @param payerAccountId
   * @param validStartMillis - The milliseconds of the desired validStart date .
   * @returns A unique validStart date.
   */
  function findUniqueValidStart(payerAccountId: string, validStartMillis: number): Date {
    let isUnique = false;

    while (!isUnique) {
      isUnique = true;

      for (const item of groupItems.value) {
        if (
          item.payerAccountId === payerAccountId &&
          item.validStart.getTime() === validStartMillis
        ) {
          isUnique = false;
          // Not unique, add 1 millisecond and break the loop
          validStartMillis += 1;
          break;
        }
      }
    }

    // Convert milliseconds back to Date and return
    return new Date(validStartMillis);
  }

  async function saveGroup(userId: string, description: string, groupValidStart: Date) {
    // Alter this when we know what 'atomic' does
    if (groupItems.value[0].groupId === undefined) {
      const newGroupId = await addGroupWithDrafts(
        userId,
        description,
        false,
        groupItems.value,
        groupValidStart,
      );
      const items = await getGroupItems(newGroupId!);
      for (const [index, groupItem] of groupItems.value.entries()) {
        groupItem.groupId = newGroupId;
        groupItem.seq = items[index].seq;
      }
    } else {
      await updateGroup(
        groupItems.value[0].groupId,
        userId,
        { description, atomic: false, groupValidStart: groupValidStart },
        groupItems.value,
      );
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

  function hasObservers(seq: number) {
    if (
      groupItems.value[seq].observers === undefined ||
      groupItems.value[seq].observers.length === 0
    ) {
      return false;
    }
    return true;
  }

  function hasApprovers(seq: number) {
    if (
      groupItems.value[seq].approvers === undefined ||
      groupItems.value[seq].approvers.length === 0
    ) {
      return false;
    }
    return true;
  }

  function setModified() {
    modified.value = true;
  }

  function isModified() {
    return modified.value;
  }

  function updateTransactionValidStarts(newGroupValidStart: Date) {
    groupItems.value.forEach((groupItem, index) => {
      const now = new Date();
      if (groupItem.validStart < now) {
        const updatedValidStart = findUniqueValidStart(
          groupItem.payerAccountId,
          newGroupValidStart.getTime() + index,
        );
        const transaction = Transaction.fromBytes(groupItem.transactionBytes);
        transaction.setTransactionId(
          createTransactionId(groupItem.payerAccountId, updatedValidStart),
        );

        groupItems.value[index] = {
          ...groupItem,
          transactionBytes: transaction.toBytes(),
          validStart: updatedValidStart,
        };
      }
    });
    groupItems.value = [...groupItems.value];

    setModified();
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
    groupValidStart,
    sequential,
    getRequiredKeys,
    editGroupItem,
    hasObservers,
    hasApprovers,
    setModified,
    isModified,
    updateTransactionValidStarts,
  };
});

export default useTransactionGroupStore;
