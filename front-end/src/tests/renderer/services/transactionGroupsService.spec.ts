// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';

import type { GroupItem as StoreGroupItem } from '@renderer/stores/storeTransactionGroup';

vi.mock('@prisma/client', () => ({ Prisma: {} }));

vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionType: vi.fn(() => 'Transfer'),
}));

import { addGroupWithDrafts, updateGroup } from '@renderer/services/transactionGroupsService';

function storeItem(overrides: Partial<StoreGroupItem> = {}): StoreGroupItem {
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

describe('transactionGroupsService.updateGroup', () => {
  let api: any;

  beforeEach(() => {
    api = {
      transactionGroups: {
        updateGroupWithItems: vi.fn(),
      },
    };
    (window as any).electronAPI = { local: api };
  });

  test('delegates the whole rewrite to updateGroupWithItems in a single call', async () => {
    const items: StoreGroupItem[] = [
      storeItem({ seq: '0', description: 'A', transactionBytes: new Uint8Array([1]) }),
      storeItem({ seq: '1', description: 'B', transactionBytes: new Uint8Array([2]) }),
      storeItem({ seq: '2', description: 'C', transactionBytes: new Uint8Array([3]) }),
    ];

    await expect(
      updateGroup('g-1', 'user-1', { description: 'd' }, items),
    ).resolves.toBeUndefined();

    expect(api.transactionGroups.updateGroupWithItems).toHaveBeenCalledTimes(1);
    const [id, group, drafts] = api.transactionGroups.updateGroupWithItems.mock.calls[0];
    expect(id).toBe('g-1');
    expect(group).toEqual({ description: 'd' });

    // Drafts are built in list order so the main process can assign seq === index.
    expect(drafts).toHaveLength(3);
    expect(drafts.map((d: any) => d.description)).toEqual(['A', 'B', 'C']);
    expect(drafts.map((d: any) => d.transactionBytes)).toEqual(['1', '2', '3']);
    drafts.forEach((d: any) => {
      expect(d.user_id).toBe('user-1');
      expect(d.type).toBe('Transfer');
    });
  });

  test('persists each item\'s isManual as the draft submitManually flag', async () => {
    await updateGroup('g-1', 'user-1', { description: 'd' }, [
      storeItem({ isManual: true }),
      storeItem({ isManual: false }),
      storeItem(),
    ]);

    const drafts = api.transactionGroups.updateGroupWithItems.mock.calls[0][2];
    expect(drafts.map((d: any) => d.submitManually)).toEqual([true, false, false]);
  });

  test('wraps a failure from the main process instead of leaving it to surface raw', async () => {
    api.transactionGroups.updateGroupWithItems.mockRejectedValue(new Error('boom'));

    await expect(updateGroup('g-1', 'user-1', { description: 'd' }, [storeItem()])).rejects.toThrow(
      'Failed to update transaction group with id: g-1',
    );
  });
});

describe('transactionGroupsService.addGroupWithDrafts', () => {
  let api: any;

  beforeEach(() => {
    api = {
      transactionGroups: {
        addGroup: vi.fn().mockResolvedValue({ id: 'g-1' }),
        addGroupItem: vi.fn(),
      },
      transactionDrafts: {
        addDraft: vi.fn().mockResolvedValue({ id: 'draft-1' }),
      },
    };
    (window as any).electronAPI = { local: api };
  });

  test('persists each item\'s isManual as the draft submitManually flag', async () => {
    const group = await addGroupWithDrafts(
      'user-1',
      'desc',
      false,
      [storeItem({ isManual: true }), storeItem({ isManual: false }), storeItem()],
      new Date(1000),
    );

    expect(group).toEqual({ id: 'g-1' });
    const created = api.transactionDrafts.addDraft.mock.calls.map((c: any) => c[0]);
    expect(created.map((d: any) => d.submitManually)).toEqual([true, false, false]);
    expect(api.transactionGroups.addGroupItem).toHaveBeenCalledTimes(3);
  });

  test('wraps a failure while saving the drafts', async () => {
    api.transactionDrafts.addDraft.mockRejectedValue(new Error('boom'));

    await expect(
      addGroupWithDrafts('user-1', 'desc', false, [storeItem()], new Date(1000)),
    ).rejects.toThrow('Failed to add transaction draft');
  });
});
