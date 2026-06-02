// @vitest-environment node
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@hiero-ledger/sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@hiero-ledger/sdk')>();
  return {
    ...actual,
    Transaction: {
      fromBytes: vi.fn(() => ({
        setTransactionId: vi.fn(),
        toBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
      })),
    },
    KeyList: { from: vi.fn() },
    PublicKey: { fromString: vi.fn() },
  };
});

vi.mock('@renderer/utils/sdk', () => ({
  createTransactionId: vi.fn(() => 'mock-tx-id'),
}));

vi.mock('@renderer/utils', () => ({
  getTransactionFromBytes: vi.fn(),
}));

vi.mock('@renderer/services/transactionGroupsService', () => ({
  getGroup: vi.fn(),
  getGroupItems: vi.fn(),
  updateGroup: vi.fn(),
  addGroupWithDrafts: vi.fn(),
}));

vi.mock('@renderer/services/transactionDraftsService', () => ({
  getDrafts: vi.fn(),
}));

vi.mock('@prisma/client', () => ({
  Prisma: {},
}));

import {
  getGroup,
  getGroupItems,
  updateGroup,
  addGroupWithDrafts,
} from '@renderer/services/transactionGroupsService';
import { getDrafts } from '@renderer/services/transactionDraftsService';
import { getTransactionFromBytes } from '@renderer/utils';
import { Transaction } from '@hiero-ledger/sdk';
import useTransactionGroupStore, {
  type RenderedGroupItem,
} from '@renderer/stores/storeTransactionGroup';

let nextTestRowKey = 0;
function createGroupItem(overrides: Partial<RenderedGroupItem> = {}): RenderedGroupItem {
  return {
    rowKey: `test-row-key-${nextTestRowKey++}`,
    transactionBytes: new Uint8Array([1, 2, 3]),
    type: 'Transfer',
    seq: '0',
    keyList: [],
    observers: [],
    approvers: [],
    payerAccountId: '0.0.1',
    validStart: new Date(1000),
    description: 'test',
    transactionMemo: '',
    transferSummary: null,
    ...overrides,
  };
}

describe('useTransactionGroupStore', () => {
  let store: ReturnType<typeof useTransactionGroupStore>;

  beforeEach(() => {
    setActivePinia(createPinia());
    store = useTransactionGroupStore();
    vi.clearAllMocks();
  });

  describe('fetchGroup', () => {
    test('should deduplicate validStarts when fetched items share the same payer and timestamp', async () => {
      const futureStart = new Date(Date.now() + 120_000);

      const mockTransaction = {
        toBytes: () => new Uint8Array([1, 2, 3]),
        transactionId: {
          accountId: { toString: () => '0.0.1' },
          validStart: { toDate: () => new Date(futureStart) },
        },
      };

      vi.mocked(getGroup).mockResolvedValue({
        id: 'group-1',
        created_at: new Date(),
        description: 'test group',
        atomic: false,
        groupValidStart: futureStart,
      });

      vi.mocked(getGroupItems).mockResolvedValue([
        { transaction_id: null, transaction_draft_id: 'draft-1', transaction_group_id: 'group-1', seq: '0' },
        { transaction_id: null, transaction_draft_id: 'draft-2', transaction_group_id: 'group-1', seq: '1' },
        { transaction_id: null, transaction_draft_id: 'draft-3', transaction_group_id: 'group-1', seq: '2' },
      ]);

      vi.mocked(getDrafts).mockResolvedValue([
        { id: 'draft-1', created_at: new Date(), updated_at: new Date(), user_id: 'user-1', transactionBytes: '0x01', type: 'Transfer', description: 'tx1', isTemplate: null, details: null },
        { id: 'draft-2', created_at: new Date(), updated_at: new Date(), user_id: 'user-1', transactionBytes: '0x02', type: 'Transfer', description: 'tx2', isTemplate: null, details: null },
        { id: 'draft-3', created_at: new Date(), updated_at: new Date(), user_id: 'user-1', transactionBytes: '0x03', type: 'Transfer', description: 'tx3', isTemplate: null, details: null },
      ]);

      vi.mocked(getTransactionFromBytes).mockReturnValue(mockTransaction as any);

      await store.fetchGroup('group-1', {});

      expect(store.groupItems).toHaveLength(3);

      const timestamps = store.groupItems.map(item => item.validStart.getTime());
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(3);
      // Only the two items the defensive dedupe nudged forward get re-serialized;
      // the one left at its original validStart is reused as-is.
      expect(vi.mocked(Transaction.fromBytes)).toHaveBeenCalledTimes(2);
    });

  });

  describe('addGroupItem', () => {
    test('should add item when no conflict exists', () => {
      const item = createGroupItem({ validStart: new Date(1000) });
      store.addGroupItem(item);

      expect(store.groupItems).toHaveLength(1);
      expect(store.groupItems[0].validStart.getTime()).toBe(1000);
    });

    test('should deduplicate validStart when conflict exists with same payer', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(1000) }),
      );

      const newItem = createGroupItem({
        seq: '1',
        payerAccountId: '0.0.1',
        validStart: new Date(1000),
      });
      store.addGroupItem(newItem);

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[1].validStart.getTime()).toBe(1001);
    });

    test('should not deduplicate when same validStart but different payer', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(1000) }),
      );

      const newItem = createGroupItem({
        seq: '1',
        payerAccountId: '0.0.2',
        validStart: new Date(1000),
      });
      store.addGroupItem(newItem);

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[1].validStart.getTime()).toBe(1000);
    });

    test('should bump past multiple consecutive conflicts', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', validStart: new Date(1000) }),
        createGroupItem({ seq: '1', validStart: new Date(1001) }),
        createGroupItem({ seq: '2', validStart: new Date(1002) }),
      );

      const newItem = createGroupItem({ seq: '3', validStart: new Date(1000) });
      store.addGroupItem(newItem);

      expect(store.groupItems).toHaveLength(4);
      expect(store.groupItems[3].validStart.getTime()).toBe(1003);
    });

    test('should mark group as modified', () => {
      expect(store.isModified()).toBe(false);
      store.addGroupItem(createGroupItem());
      expect(store.isModified()).toBe(true);
    });

    test('parses transactionBytes only once even when dedup rewrites the validStart', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(1000) }),
      );
      vi.mocked(Transaction.fromBytes).mockClear();

      store.addGroupItem(
        createGroupItem({ seq: '1', payerAccountId: '0.0.1', validStart: new Date(1000) }),
      );

      expect(vi.mocked(Transaction.fromBytes)).toHaveBeenCalledTimes(1);
    });
  });

  describe('editGroupItem', () => {
    test('should replace item at the correct index', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', description: 'original-0' }),
        createGroupItem({ seq: '1', description: 'original-1' }),
      );

      const edited = createGroupItem({ seq: '1', description: 'edited-1' });
      store.editGroupItem(edited);

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[1].description).toBe('edited-1');
    });

    test('should deduplicate validStart when conflict exists with another item', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', validStart: new Date(1000) }),
        createGroupItem({ seq: '1', validStart: new Date(2000) }),
      );

      const edited = createGroupItem({ seq: '1', validStart: new Date(1000) });
      store.editGroupItem(edited);

      expect(store.groupItems[1].validStart.getTime()).toBe(1001);
    });

    test('should not bump when editing item keeps its own validStart (excludeIndex)', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', validStart: new Date(1000) }),
        createGroupItem({ seq: '1', validStart: new Date(2000) }),
      );

      const edited = createGroupItem({ seq: '0', validStart: new Date(1000) });
      store.editGroupItem(edited);

      expect(store.groupItems[0].validStart.getTime()).toBe(1000);
    });

    test('should no-op when seq exceeds array length', () => {
      store.groupItems.push(createGroupItem({ seq: '0', description: 'original' }));

      const edited = createGroupItem({ seq: '5', description: 'should-not-appear' });
      store.editGroupItem(edited);

      expect(store.groupItems).toHaveLength(1);
      expect(store.groupItems[0].description).toBe('original');
    });

    test('should no-op when seq is negative', () => {
      store.groupItems.push(createGroupItem({ seq: '0', description: 'original' }));

      const edited = createGroupItem({ seq: '-1' });
      store.editGroupItem(edited);

      expect(store.groupItems).toHaveLength(1);
      expect(store.groupItems[0].description).toBe('original');
    });

    test('should not set modified when seq is out of bounds', () => {
      store.groupItems.push(createGroupItem({ seq: '0' }));

      const edited = createGroupItem({ seq: '5' });
      store.editGroupItem(edited);

      expect(store.isModified()).toBe(false);
    });

    test('should mark group as modified on valid edit', () => {
      store.groupItems.push(createGroupItem({ seq: '0' }));
      expect(store.isModified()).toBe(false);

      store.editGroupItem(createGroupItem({ seq: '0', description: 'edited' }));
      expect(store.isModified()).toBe(true);
    });

    test('parses transactionBytes only once even when dedup rewrites the validStart', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(1000) }),
        createGroupItem({ seq: '1', payerAccountId: '0.0.1', validStart: new Date(2000) }),
      );
      vi.mocked(Transaction.fromBytes).mockClear();

      store.editGroupItem(
        createGroupItem({ seq: '1', payerAccountId: '0.0.1', validStart: new Date(1000) }),
      );

      expect(vi.mocked(Transaction.fromBytes)).toHaveBeenCalledTimes(1);
    });

    test('should no-op when seq is a non-numeric string (NaN)', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', description: 'original-0' }),
        createGroupItem({ seq: '1', description: 'original-1' }),
      );

      const edited = createGroupItem({ seq: 'abc', description: 'should-not-appear' });
      store.editGroupItem(edited);

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[0].description).toBe('original-0');
      expect(store.groupItems[1].description).toBe('original-1');
      expect(store.isModified()).toBe(false);
    });
  });

  describe('ordering and seq invariant', () => {
    // Use distinct payers so validStarts stay unique without dedupe bumping them.
    function items(times: number[]): RenderedGroupItem[] {
      return times.map((t, i) =>
        createGroupItem({
          seq: i.toString(),
          payerAccountId: `0.0.${i + 1}`,
          description: `t-${t}`,
          validStart: new Date(t),
        }),
      );
    }

    test('addGroupItem keeps groupItems sorted by validStart', () => {
      store.addGroupItem(items([3000])[0]);
      store.addGroupItem(items([1000])[0]);
      store.addGroupItem(items([2000])[0]);

      expect(store.groupItems.map(i => i.validStart.getTime())).toEqual([1000, 2000, 3000]);
    });

    test('seq always mirrors the array index after a mutation', () => {
      store.groupItems.push(...items([0, 5, 10, 15, 20]));
      // Force a renumber through a no-op-ish edit at the last slot.
      store.editGroupItem(
        createGroupItem({ seq: '4', payerAccountId: '0.0.5', validStart: new Date(20) }),
      );

      expect(store.groupItems.map(i => i.seq)).toEqual(['0', '1', '2', '3', '4']);
    });

    test('editing an item\'s validStart reorders the list and the row follows', () => {
      // 5 items at 0,5,10,15,20 (ms); edit the last (seq 4, t=20) down to t=11.
      const seeded = items([0, 5, 10, 15, 20]);
      store.groupItems.push(...seeded);
      const movedRowKey = store.groupItems[4].rowKey;

      store.editGroupItem(
        createGroupItem({ seq: '4', payerAccountId: '0.0.5', validStart: new Date(11) }),
      );

      // Reordered by validStart: 0,5,10,11,15 — the edited item lands at index 3.
      expect(store.groupItems.map(i => i.validStart.getTime())).toEqual([0, 5, 10, 11, 15]);
      expect(store.groupItems[3].rowKey).toBe(movedRowKey);
      // seq is renumbered to the new positions.
      expect(store.groupItems.map(i => i.seq)).toEqual(['0', '1', '2', '3', '4']);
      // groupValidStart still mirrors the first (earliest) item.
      expect(store.groupValidStart.getTime()).toBe(0);
    });

    test('removeGroupItem renumbers seq to stay contiguous', () => {
      store.groupItems.push(...items([0, 5, 10]));

      store.removeGroupItem(1);

      expect(store.groupItems.map(i => i.validStart.getTime())).toEqual([0, 10]);
      expect(store.groupItems.map(i => i.seq)).toEqual(['0', '1']);
    });
  });

  describe('updateTransactionValidStarts', () => {
    test('should assign unique timestamps to all items with same payer', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(500) }),
        createGroupItem({ seq: '1', payerAccountId: '0.0.1', validStart: new Date(500) }),
        createGroupItem({ seq: '2', payerAccountId: '0.0.1', validStart: new Date(500) }),
      );

      store.updateTransactionValidStarts(new Date(2000));

      const timestamps = store.groupItems.map(item => item.validStart.getTime());
      expect(timestamps).toEqual([2000, 2001, 2002]);
    });

    test('should handle items with different payers independently', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(500) }),
        createGroupItem({ seq: '1', payerAccountId: '0.0.2', validStart: new Date(500) }),
        createGroupItem({ seq: '2', payerAccountId: '0.0.1', validStart: new Date(500) }),
      );

      store.updateTransactionValidStarts(new Date(2000));

      const timestamps = store.groupItems.map(item => item.validStart.getTime());
      expect(timestamps).toEqual([2000, 2000, 2001]);
    });

    test('should produce all-unique timestamps even with many same-payer items', () => {
      for (let i = 0; i < 10; i++) {
        store.groupItems.push(
          createGroupItem({ seq: i.toString(), payerAccountId: '0.0.1', validStart: new Date(0) }),
        );
      }

      store.updateTransactionValidStarts(new Date(5000));

      const timestamps = store.groupItems.map(item => item.validStart.getTime());
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(10);
    });

    test('shifts the whole group earlier when the new start is before the current earliest', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', validStart: new Date(3000) }),
        createGroupItem({ seq: '1', validStart: new Date(3001) }),
      );

      // earliest is 3000; targeting 2000 shifts everything back by 1000ms,
      // preserving the 1ms offset between the two items.
      store.updateTransactionValidStarts(new Date(2000));

      expect(store.groupItems[0].validStart.getTime()).toBe(2000);
      expect(store.groupItems[1].validStart.getTime()).toBe(2001);
    });

    test('should mark as modified when called with a future validStart different from initial', () => {
      store.groupItems.push(createGroupItem({ seq: '0' }));

      const futureDate = new Date(Date.now() + 60_000);
      store.updateTransactionValidStarts(futureDate);

      expect(store.isModified()).toBe(true);
    });

    test('should not mark as modified when called with a past validStart', () => {
      store.groupItems.push(createGroupItem({ seq: '0' }));

      store.updateTransactionValidStarts(new Date(0));

      expect(store.isModified()).toBe(false);
    });

    test('shifts items by a fixed delta, preserving their relative offsets', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(1000) }),
        createGroupItem({ seq: '1', payerAccountId: '0.0.1', validStart: new Date(2000) }),
        createGroupItem({ seq: '2', payerAccountId: '0.0.1', validStart: new Date(3000) }),
      );

      // earliest is 1000; targeting 2000 shifts the group forward by 1000ms.
      store.updateTransactionValidStarts(new Date(2000));

      const timestamps = store.groupItems.map(item => item.validStart.getTime());
      expect(timestamps).toEqual([2000, 3000, 4000]);
    });
  });

  describe('duplicateGroupItem', () => {
    test('should create a copy with unique validStart', () => {
      store.groupItems.push(
        createGroupItem({
          seq: '0',
          payerAccountId: '0.0.1',
          validStart: new Date(1000),
          description: 'original',
        }),
      );

      store.duplicateGroupItem(0);

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[1].description).toBe('original');
      expect(store.groupItems[1].seq).toBe('1');
      expect(store.groupItems[1].validStart.getTime()).toBe(1001);
    });

    test('should bump past existing timestamps when duplicating', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', validStart: new Date(1000) }),
        createGroupItem({ seq: '1', validStart: new Date(1001) }),
      );

      store.duplicateGroupItem(0);

      expect(store.groupItems).toHaveLength(3);
      expect(store.groupItems[2].validStart.getTime()).toBe(1002);
    });
  });

  describe('removeGroupItem', () => {
    test('should remove item at the given index', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', description: 'a' }),
        createGroupItem({ seq: '1', description: 'b' }),
        createGroupItem({ seq: '2', description: 'c' }),
      );

      store.removeGroupItem(1);

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[0].description).toBe('a');
      expect(store.groupItems[1].description).toBe('c');
    });
  });

  describe('saveGroup', () => {
    test('updates the bound group regardless of item order, even if a new item sorts to index 0', async () => {
      // Session bound to a persisted group, plus a brand-new untagged item whose
      // earlier validStart sorts it ahead of the loaded one. The create-vs-update
      // decision keys off the bound group, not groupItems[0].
      store.group = { id: 'g-1' } as never;
      store.groupItems.push(
        createGroupItem({ payerAccountId: '0.0.1', validStart: new Date(5000), groupId: 'g-1' }),
        createGroupItem({ payerAccountId: '0.0.2', validStart: new Date(1000) }),
      );
      // sortAndSyncGroupItems runs on mutation; mimic the sorted state directly.
      store.groupItems.sort((a, b) => a.validStart.getTime() - b.validStart.getTime());
      expect(store.groupItems[0].groupId).toBeUndefined();

      await store.saveGroup('user-1', 'desc', new Date(1000));

      expect(addGroupWithDrafts).not.toHaveBeenCalled();
      expect(updateGroup).toHaveBeenCalledWith(
        'g-1',
        'user-1',
        expect.objectContaining({ description: 'desc' }),
        store.groupItems,
      );
    });

    test('creates a new group when the session is not bound to a persisted group', async () => {
      vi.mocked(addGroupWithDrafts).mockResolvedValue({ id: 'new-group' } as never);
      vi.mocked(getGroupItems).mockResolvedValue([{ seq: '0' }, { seq: '1' }] as never);
      expect(store.group).toBeNull();
      store.groupItems.push(
        createGroupItem({ payerAccountId: '0.0.1', validStart: new Date(1000) }),
        createGroupItem({ payerAccountId: '0.0.2', validStart: new Date(2000) }),
      );

      await store.saveGroup('user-1', 'desc', new Date(1000));

      expect(updateGroup).not.toHaveBeenCalled();
      expect(addGroupWithDrafts).toHaveBeenCalled();
      // Newly created items get tagged with the returned group id.
      expect(store.groupItems.every(i => i.groupId === 'new-group')).toBe(true);
    });

    test('binds the session to the new group so a second save updates instead of duplicating', async () => {
      vi.mocked(addGroupWithDrafts).mockResolvedValue({
        id: 'new-group',
        groupValidStart: new Date(1000),
      } as never);
      vi.mocked(getGroupItems).mockResolvedValue([{ seq: '0' }] as never);
      store.groupItems.push(createGroupItem({ payerAccountId: '0.0.1', validStart: new Date(1000) }));

      await store.saveGroup('user-1', 'desc', new Date(1000));

      // The first save persisted the group and bound the session to it.
      expect(store.group?.id).toBe('new-group');
      expect(addGroupWithDrafts).toHaveBeenCalledTimes(1);

      await store.saveGroup('user-1', 'desc', new Date(1000));

      // The second save must take the update path, not create a duplicate group.
      expect(addGroupWithDrafts).toHaveBeenCalledTimes(1);
      expect(updateGroup).toHaveBeenCalledWith(
        'new-group',
        'user-1',
        expect.objectContaining({ description: 'desc' }),
        store.groupItems,
      );
    });
  });

  describe('nextValidStart', () => {
    test('falls back to groupValidStart when there are no items', () => {
      store.groupValidStart = new Date(7000);

      expect(store.nextValidStart.getTime()).toBe(7000);
    });

    test('returns one millisecond past the latest item so the new item sorts last with a unique timestamp', () => {
      store.groupItems.push(
        createGroupItem({ validStart: new Date(1000) }),
        createGroupItem({ validStart: new Date(5000) }),
        createGroupItem({ validStart: new Date(3000) }),
      );

      expect(store.nextValidStart.getTime()).toBe(5001);
    });
  });

  describe('clearGroup', () => {
    test('should reset all state', () => {
      store.groupItems.push(createGroupItem());
      store.description = 'test';
      store.sequential = true;
      store.setModified();

      store.clearGroup();

      expect(store.groupItems).toHaveLength(0);
      expect(store.description).toBe('');
      expect(store.sequential).toBe(false);
      expect(store.isModified()).toBe(false);
    });
  });

  describe('item rowKey (stable client identity)', () => {
    test('addGroupItem assigns a rowKey even when the caller does not provide one', () => {
      const { rowKey: _ignored, ...itemWithoutRowKey } = createGroupItem();
      store.addGroupItem(itemWithoutRowKey);

      expect(store.groupItems[0].rowKey).toBeTruthy();
      expect(typeof store.groupItems[0].rowKey).toBe('string');
    });

    test('addGroupItem overwrites any rowKey the caller passed (store owns rowKey assignment)', () => {
      store.addGroupItem(createGroupItem({ rowKey: 'caller-supplied-row-key' }));

      expect(store.groupItems[0].rowKey).not.toBe('caller-supplied-row-key');
      expect(store.groupItems[0].rowKey).toBeTruthy();
    });

    test('every addGroupItem call produces a unique rowKey', () => {
      store.addGroupItem(createGroupItem({ seq: '0', validStart: new Date(1000) }));
      store.addGroupItem(createGroupItem({ seq: '1', validStart: new Date(2000) }));
      store.addGroupItem(createGroupItem({ seq: '2', validStart: new Date(3000) }));

      const rowKeys = store.groupItems.map(i => i.rowKey);
      expect(new Set(rowKeys).size).toBe(3);
    });

    test('editGroupItem preserves the slot rowKey so v-for keys stay stable across edits', () => {
      store.addGroupItem(createGroupItem({ seq: '0', description: 'original' }));
      const originalRowKey = store.groupItems[0].rowKey;

      store.editGroupItem(createGroupItem({ seq: '0', description: 'edited' }));

      expect(store.groupItems[0].rowKey).toBe(originalRowKey);
      expect(store.groupItems[0].description).toBe('edited');
    });

    test('editGroupItem ignores a rowKey the caller passed, keeping the slot rowKey', () => {
      store.addGroupItem(createGroupItem({ seq: '0' }));
      const originalRowKey = store.groupItems[0].rowKey;

      store.editGroupItem(createGroupItem({ seq: '0', rowKey: 'caller-supplied-row-key' }));

      expect(store.groupItems[0].rowKey).toBe(originalRowKey);
    });

    test('duplicateGroupItem gives the new item a fresh rowKey distinct from the source', () => {
      store.addGroupItem(createGroupItem({ seq: '0' }));
      const sourceRowKey = store.groupItems[0].rowKey;

      store.duplicateGroupItem(0);

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[1].rowKey).toBeTruthy();
      expect(store.groupItems[1].rowKey).not.toBe(sourceRowKey);
    });

    test('updateTransactionValidStarts preserves item rowKeys across per-tick rewrites', () => {
      store.addGroupItem(createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(1000) }));
      store.addGroupItem(createGroupItem({ seq: '1', payerAccountId: '0.0.1', validStart: new Date(2000) }));
      const rowKeysBefore = store.groupItems.map(i => i.rowKey);

      store.updateTransactionValidStarts(new Date(5000));

      const rowKeysAfter = store.groupItems.map(i => i.rowKey);
      expect(rowKeysAfter).toEqual(rowKeysBefore);
    });

    test('fetchGroup assigns fresh rowKeys to each hydrated item', async () => {
      const futureStart = new Date(Date.now() + 120_000);
      const mockTransaction = {
        toBytes: () => new Uint8Array([1, 2, 3]),
        transactionId: {
          accountId: { toString: () => '0.0.1' },
          validStart: { toDate: () => new Date(futureStart) },
        },
      };

      vi.mocked(getGroup).mockResolvedValue({
        id: 'group-1',
        created_at: new Date(),
        description: 'g',
        atomic: false,
        groupValidStart: futureStart,
      });
      vi.mocked(getGroupItems).mockResolvedValue([
        { transaction_id: null, transaction_draft_id: 'd1', transaction_group_id: 'group-1', seq: '0' },
        { transaction_id: null, transaction_draft_id: 'd2', transaction_group_id: 'group-1', seq: '1' },
      ]);
      vi.mocked(getDrafts).mockResolvedValue([
        { id: 'd1', created_at: new Date(), updated_at: new Date(), user_id: 'u', transactionBytes: '0x01', type: 'Transfer', description: 'a', isTemplate: null, details: null },
        { id: 'd2', created_at: new Date(), updated_at: new Date(), user_id: 'u', transactionBytes: '0x02', type: 'Transfer', description: 'b', isTemplate: null, details: null },
      ]);
      vi.mocked(getTransactionFromBytes).mockReturnValue(mockTransaction as any);

      await store.fetchGroup('group-1', {});

      expect(store.groupItems).toHaveLength(2);
      expect(store.groupItems[0].rowKey).toBeTruthy();
      expect(store.groupItems[1].rowKey).toBeTruthy();
      expect(store.groupItems[0].rowKey).not.toBe(store.groupItems[1].rowKey);
      // The two items collide on load; the defensive dedupe nudges one forward
      // (1 re-serialization) and leaves the other at its original validStart.
      expect(vi.mocked(Transaction.fromBytes)).toHaveBeenCalledTimes(1);
    });
  });

  describe('derived display fields (transactionMemo, transferSummary)', () => {
    test('addGroupItem populates transactionMemo and transferSummary on the stored item', () => {
      const { rowKey: _, ...input } = createGroupItem();
      store.addGroupItem(input);

      // SDK mock returns a transaction without memo and not instanceof TransferTransaction,
      // so the derived fields land at their non-transfer defaults.
      expect(store.groupItems[0].transactionMemo).toBe('');
      expect(store.groupItems[0].transferSummary).toBeNull();
    });

    test('updateTransactionValidStarts preserves derived display fields across per-tick rewrites', () => {
      store.addGroupItem(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(1000) }),
      );
      // Simulate a render-time precomputed memo + summary on the stored item
      // (would normally come from deriveDisplay during addGroupItem; we set it
      // directly here to verify the per-tick rewrite path doesn't clobber them).
      store.groupItems[0].transactionMemo = 'precomputed-memo';
      store.groupItems[0].transferSummary = '<b>precomputed</b>';

      store.updateTransactionValidStarts(new Date(5000));

      expect(store.groupItems[0].transactionMemo).toBe('precomputed-memo');
      expect(store.groupItems[0].transferSummary).toBe('<b>precomputed</b>');
    });
  });
});
