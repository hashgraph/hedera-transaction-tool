import type { TransactionApproverDto } from '@shared/interfaces';

import type { TransactionGroup } from '@prisma/client';

import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { KeyList, PublicKey, Transaction, TransferTransaction } from '@hiero-ledger/sdk';
import { Prisma } from '@prisma/client';

import { getDrafts } from '@renderer/services/transactionDraftsService';
import {
  addGroupWithDrafts,
  getGroup,
  getGroupItems,
  updateGroup,
} from '@renderer/services/transactionGroupsService';

import { formatHbarTransfers, getTransactionFromBytes } from '@renderer/utils';
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

/**
 * Variant of {@link GroupItem} as held by the Pinia store and consumed by the
 * row renderer. Adds:
 * - `rowKey`: stable client-only id for v-for and any tracking that needs to
 *   follow a row across edits, ticks, and reorders. Named `rowKey` (not `key`)
 *   to avoid confusion with the many cryptographic keys on transaction types.
 * - `transactionMemo` / `transferSummary`: derived display values, computed
 *   once when an item enters the store. Pre-computing them keeps the row
 *   template free of `Transaction.fromBytes(...)` calls, which would otherwise
 *   re-deserialize every reactive bytes update (e.g. each clock tick that
 *   rewrites `transactionBytes` with a new valid-start).
 *
 * None of these fields are persisted. Code paths that only need the bare shape
 * (e.g. mutator inputs, persistence service) should use {@link GroupItem}.
 */
export interface RenderedGroupItem extends GroupItem {
  rowKey: string;
  transactionMemo: string;
  transferSummary: string | null;
}

/**
 * Computes precomputed display fields for a group item from either a transaction
 * instance or its bytes. Accepting a transaction lets hydration paths reuse an
 * already-deserialized object and avoid redundant parsing.
 */
function deriveDisplay(transaction: Transaction): {
  transactionMemo: string;
  transferSummary: string | null;
} {
  const transferSummary =
    transaction instanceof TransferTransaction
      ? formatHbarTransfers(transaction.hbarTransfersList)
      : null;
  return {
    transactionMemo: transaction.transactionMemo || '',
    transferSummary,
  };
}

const useTransactionGroupStore = defineStore('transactionGroup', () => {
  /* State */
  // The persisted group this editing session is bound to, or null for a group
  // that hasn't been saved yet. Carries the stable identity (`id`) that saveGroup
  // uses to decide create-vs-update — independent of item order or which items
  // are tagged. The description/groupValidStart refs below are the live editable
  // working copy; this snapshot is identity/baseline only.
  const group = ref<TransactionGroup | null>(null);
  const groupItems = ref<RenderedGroupItem[]>([]);
  const groupValidStart = ref(new Date());
  const groupInitialValidStart = ref(new Date());
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
    const fetchedGroup = await getGroup(id);
    group.value = fetchedGroup;
    description.value = fetchedGroup.description;
    if (fetchedGroup.groupValidStart) {
      // Baseline for the modified-flag guard in updateTransactionValidStarts.
      // The picker's actual value is derived from the items below (via the
      // target/shift), not from this stored field, so we only record it here.
      groupInitialValidStart.value = fetchedGroup.groupValidStart;
    }

    const items = await getGroupItems(id);
    const drafts = await getDrafts(findArgs);
    const groupItemsToAdd: RenderedGroupItem[] = [];

    for (const item of items) {
      const draft = drafts.find(draft => draft.id == item.transaction_draft_id);
      if (draft?.transactionBytes) {
        const transaction = getTransactionFromBytes(draft.transactionBytes);
        groupItemsToAdd.push({
          rowKey: crypto.randomUUID(),
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
          ...deriveDisplay(transaction),
        });
      }
    }

    groupItemsToAdd.sort((a, b) => a.validStart.getTime() - b.validStart.getTime());
    // seq mirrors the array index (the order shift preserves below).
    groupItems.value = groupItemsToAdd.map((item, index) => ({
      ...item,
      seq: index.toString(),
    }));

    // Never load items into the past: shift the whole group forward to "now" if
    // the earliest item is stale, otherwise anchor on the earliest item. This
    // call also establishes the post-load invariants (sorted order, seq === index,
    // groupValidStart === first item). When target === earliest the delta is 0,
    // so updateTransactionValidStarts re-serializes nothing and just runs those
    // syncs — cheap enough that guarding the call buys nothing.
    const earliestItem = earliestItemTime();
    const target = Math.max(earliestItem ?? Date.now(), Date.now());
    updateTransactionValidStarts(new Date(target));
  }

  function clearGroup() {
    group.value = null;
    groupItems.value = [];
    groupValidStart.value = new Date();
    groupInitialValidStart.value = new Date();
    description.value = '';
    sequential.value = false;
    modified.value = false;
  }

  function addGroupItem(groupItem: GroupItem) {
    const uniqueValidStart = findUniqueValidStart(
      groupItem.payerAccountId,
      groupItem.validStart.getTime(),
    );
    const transaction = Transaction.fromBytes(groupItem.transactionBytes);
    if (uniqueValidStart.getTime() !== groupItem.validStart.getTime()) {
      transaction.setTransactionId(
        createTransactionId(groupItem.payerAccountId, uniqueValidStart),
      );
      groupItem = {
        ...groupItem,
        transactionBytes: transaction.toBytes(),
        validStart: uniqueValidStart,
      };
    }
    groupItems.value = [
      ...groupItems.value,
      {
        ...groupItem,
        rowKey: crypto.randomUUID(),
        ...deriveDisplay(transaction),
      },
    ];
    sortAndSyncGroupItems();
    setModified();
  }

  function editGroupItem(newGroupItem: GroupItem) {
    const editIndex = Number.parseInt(newGroupItem.seq);
    if (!(editIndex >= 0 && editIndex < groupItems.value.length)) return;
    const uniqueValidStart = findUniqueValidStart(
      newGroupItem.payerAccountId,
      newGroupItem.validStart.getTime(),
      editIndex,
    );
    const transaction = Transaction.fromBytes(newGroupItem.transactionBytes);
    if (uniqueValidStart.getTime() !== newGroupItem.validStart.getTime()) {
      transaction.setTransactionId(
        createTransactionId(newGroupItem.payerAccountId, uniqueValidStart),
      );
      newGroupItem = {
        ...newGroupItem,
        transactionBytes: transaction.toBytes(),
        validStart: uniqueValidStart,
      };
    }
    groupItems.value = [
      ...groupItems.value.slice(0, editIndex),
      // Preserve the slot's stable row key across edits so Vue keeps the same row instance.
      // Recompute display fields since the bytes may have changed.
      {
        ...newGroupItem,
        rowKey: groupItems.value[editIndex].rowKey,
        ...deriveDisplay(transaction),
      },
      ...groupItems.value.slice(editIndex + 1),
    ];
    sortAndSyncGroupItems();
    setModified();
  }

  function removeGroupItem(index: number) {
    groupItems.value = [...groupItems.value.slice(0, index), ...groupItems.value.slice(index + 1)];
    sortAndSyncGroupItems();
    setModified();
  }

  /**
   * Duplicates a group item at the specified index.
   * The resulting transaction will be identical to the original,
   * except for the validStart date and seq number.
   * @param index
   */
  function duplicateGroupItem(index: number) {
    const baseItem = groupItems.value[index];
    const newDate = findUniqueValidStart(
      baseItem.payerAccountId,
      baseItem.validStart.getTime() + 1,
    );
    const transaction = Transaction.fromBytes(baseItem.transactionBytes);
    transaction.setTransactionId(createTransactionId(baseItem.payerAccountId, newDate));
    const newItem: RenderedGroupItem = {
      rowKey: crypto.randomUUID(),
      transactionBytes: transaction.toBytes(),
      type: baseItem.type,
      description: baseItem.description,
      // seq is assigned authoritatively by sortAndSyncGroupItems below.
      seq: '',
      keyList: baseItem.keyList,
      observers: baseItem.observers,
      approvers: baseItem.approvers,
      payerAccountId: baseItem.payerAccountId,
      validStart: newDate,
      ...deriveDisplay(transaction),
    };

    groupItems.value = [...groupItems.value, newItem];
    sortAndSyncGroupItems();
    setModified();
  }

  // The valid start to seed a brand-new group item with: one millisecond past
  // the latest existing item so it lands after the current items with a unique
  // timestamp (Date is millisecond-resolution, so 1ms is the smallest bump).
  // Falls back to groupValidStart when the group is still empty.
  const nextValidStart = computed(() => {
    if (groupItems.value.length === 0) return groupValidStart.value;
    const latest = groupItems.value.reduce(
      (max, item) => Math.max(max, item.validStart.getTime()),
      -Infinity,
    );
    return new Date(latest + 1);
  });

  function earliestItemTime(): number | null {
    if (groupItems.value.length === 0) return null;
    return groupItems.value.reduce(
      (min, item) => Math.min(min, item.validStart.getTime()),
      Infinity,
    );
  }

  // Keep groupItems ordered by validStart (ascending), renumber each item's
  // seq to its new array index, and mirror groupValidStart to the earliest
  // (now first) item. Sorting the array itself — not just the rendered view —
  // means the on-screen order, the v-for index, the seq, and the persisted
  // order all agree, and editing an item's time reorders the row.
  //
  // seq is purely the array index: the persistence layer always writes
  // `seq: index.toString()` (see transactionGroupsService) and editGroupItem
  // consumes seq as an index, so keeping it in sync here makes it truthful
  // rather than a value that goes stale after a reorder.
  //
  // rowKey travels with each item, so Vue moves the existing DOM rows instead
  // of rebuilding them.
  function sortAndSyncGroupItems() {
    groupItems.value = [...groupItems.value]
      .sort((a, b) => a.validStart.getTime() - b.validStart.getTime())
      .map((item, index) => {
        const seq = index.toString();
        // Preserve object identity when nothing changed to avoid needless churn.
        return item.seq === seq ? item : { ...item, seq };
      });
    const earliest = earliestItemTime();
    if (earliest !== null) {
      groupValidStart.value = new Date(earliest);
    }
  }

  /**
   * Finds a unique validStart date for a group item.
   *
   * Unlike {@link nextValidStart}, this is not about appending after the latest
   * item: it takes a specific desired validStart and nudges it forward only as
   * far as needed to differentiate it from another item (same payer) that
   * already holds that exact timestamp. The passed-in time is the anchor; we
   * return the next free slot at or after it.
   *
   * @param payerAccountId
   * @param validStartMillis - The milliseconds of the desired validStart date .
   * @param excludeIndex
   * @returns A unique validStart date.
   */
  function findUniqueValidStart(
    payerAccountId: string,
    validStartMillis: number,
    excludeIndex?: number,
  ): Date {
    let isUnique = false;

    while (!isUnique) {
      isUnique = true;

      for (const [index, item] of groupItems.value.entries()) {
        if (index === excludeIndex) continue;
        if (
          item.payerAccountId === payerAccountId &&
          item.validStart.getTime() === validStartMillis
        ) {
          isUnique = false;
          validStartMillis += 1;
          break;
        }
      }
    }

    return new Date(validStartMillis);
  }

  async function saveGroup(userId: string, description: string, groupValidStart: Date) {
    // Create-vs-update is decided by whether this session is bound to a persisted
    // group, not by inspecting items: sorting by validStart can move a brand-new
    // (untagged) item to index 0, so an item-based check would misread an edited
    // group as new and create a duplicate.
    // Alter this when we know what 'atomic' does.
    if (group.value === null) {
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
        group.value.id,
        userId,
        { description, atomic: false, groupValidStart: groupValidStart },
        groupItems.value,
      );
    }
  }

  function getRequiredKeys() {
    const keys = new Array<string>();
    for (const groupItem of groupItems.value) {
      keys.push(...groupItem.keyList);
    }
    const keySet = new Set(keys);
    const returningKeys = Array.from(keySet).map(key => PublicKey.fromString(key));
    return KeyList.from(returningKeys);
  }

  function hasObservers(seq: number) {
    return !(
      groupItems.value[seq].observers === undefined || groupItems.value[seq].observers.length === 0
    );
  }

  function hasApprovers(seq: number) {
    return !(
      groupItems.value[seq].approvers === undefined || groupItems.value[seq].approvers.length === 0
    );
  }

  function setModified() {
    modified.value = true;
  }

  function isModified() {
    return modified.value;
  }

  function updateTransactionValidStarts(newGroupValidStart: Date) {
    // Shift every item by (newGroupValidStart - earliestItem) so the relative
    // offsets between transactions are preserved and the earliest item ends up
    // at newGroupValidStart.

    if (groupItems.value.length === 0) {
      groupValidStart.value = newGroupValidStart;
      return;
    }

    const earliest = earliestItemTime() as number;
    const delta = newGroupValidStart.getTime() - earliest;

    // Compute shifted timestamps in a separate buffer so transient duplicates
    // with not-yet-shifted neighbors don't trip the dedupe pass.
    const shifted = groupItems.value.map(item => ({
      ...item,
      validStart: new Date(item.validStart.getTime() + delta),
    }));

    // Pure shift preserves per-payer uniqueness, but stay defensive against
    // any duplicates that may have slipped in (e.g. malformed loaded data).
    for (let i = 0; i < shifted.length; i++) {
      let candidate = shifted[i].validStart.getTime();
      let collides = true;
      while (collides) {
        collides = false;
        for (let j = 0; j < shifted.length; j++) {
          if (i === j) continue;
          if (
            shifted[j].payerAccountId === shifted[i].payerAccountId &&
            shifted[j].validStart.getTime() === candidate
          ) {
            collides = true;
            candidate += 1;
            break;
          }
        }
      }
      shifted[i] = { ...shifted[i], validStart: new Date(candidate) };
    }

    groupItems.value = shifted.map((item, index) => {
      if (item.validStart.getTime() === groupItems.value[index].validStart.getTime()) {
        return item;
      }
      const transaction = Transaction.fromBytes(item.transactionBytes);
      transaction.setTransactionId(
        createTransactionId(item.payerAccountId, item.validStart),
      );

      return { ...item, transactionBytes: transaction.toBytes() };
    });
    // A pure shift preserves order, but the defensive dedupe above can nudge
    // items past one another; re-sort + renumber seq + sync groupValidStart so
    // the invariant (sorted, seq === index, groupValidStart === first item) holds.
    sortAndSyncGroupItems();

    const now = new Date();
    if (
      newGroupValidStart.getTime() !== groupInitialValidStart.value.getTime() &&
      (newGroupValidStart > now || groupInitialValidStart.value > now)
    ) {
      setModified();
    }
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
  //   TODO
  //   return new Array<TransactionApproverDto>();
  // }

  return {
    fetchGroup,
    addGroupItem,
    removeGroupItem,
    duplicateGroupItem,
    saveGroup,
    clearGroup,
    group,
    groupItems,
    description,
    groupValidStart,
    nextValidStart,
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
