// @vitest-environment node
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('@hashgraph/sdk', () => ({
  Transaction: {
    fromBytes: vi.fn(() => ({
      setTransactionId: vi.fn(),
      toBytes: vi.fn(() => new Uint8Array([1, 2, 3])),
    })),
  },
  KeyList: { from: vi.fn() },
  PublicKey: { fromString: vi.fn() },
}));

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

import { getGroup, getGroupItems } from '@renderer/services/transactionGroupsService';
import { getDrafts } from '@renderer/services/transactionDraftsService';
import { getTransactionFromBytes } from '@renderer/utils';
import useTransactionGroupStore, {
  type GroupItem,
} from '@renderer/stores/storeTransactionGroup';

function createGroupItem(overrides: Partial<GroupItem> = {}): GroupItem {
  return {
    transactionBytes: new Uint8Array([1, 2, 3]),
    type: 'Transfer',
    seq: '0',
    keyList: [],
    observers: [],
    approvers: [],
    payerAccountId: '0.0.1',
    validStart: new Date(1000),
    description: 'test',
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
      expect(timestamps).toEqual([2000, 2001, 2002]);
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

    test('should update all items regardless of whether validStart is past or future', () => {
      const futureDate = new Date(Date.now() + 60_000);
      store.groupItems.push(
        createGroupItem({ seq: '0', validStart: new Date(0) }),
        createGroupItem({ seq: '1', validStart: futureDate }),
      );

      const newValidStart = new Date(3000);
      store.updateTransactionValidStarts(newValidStart);

      expect(store.groupItems[0].validStart.getTime()).toBe(3000);
      expect(store.groupItems[1].validStart.getTime()).toBe(3001);
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

    test('should still produce unique timestamps when old validStarts overlap with new range', () => {
      store.groupItems.push(
        createGroupItem({ seq: '0', payerAccountId: '0.0.1', validStart: new Date(2001) }),
        createGroupItem({ seq: '1', payerAccountId: '0.0.1', validStart: new Date(2000) }),
        createGroupItem({ seq: '2', payerAccountId: '0.0.1', validStart: new Date(2002) }),
      );

      store.updateTransactionValidStarts(new Date(2000));

      const timestamps = store.groupItems.map(item => item.validStart.getTime());
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(3);
      // All timestamps must be >= the group valid start
      for (const ts of timestamps) {
        expect(ts).toBeGreaterThanOrEqual(2000);
      }
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
});
