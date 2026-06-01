// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';

import type { GroupItem as StoreGroupItem } from '@renderer/stores/storeTransactionGroup';

vi.mock('@prisma/client', () => ({ Prisma: {} }));

vi.mock('@renderer/services/transactionDraftsService', () => ({
  deleteDraft: vi.fn(),
}));

vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionType: vi.fn(() => 'Transfer'),
}));

import { updateGroup } from '@renderer/services/transactionGroupsService';
import { deleteDraft } from '@renderer/services/transactionDraftsService';

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
  let addedDraftSeq: number;

  beforeEach(() => {
    addedDraftSeq = 0;
    api = {
      transactionGroups: {
        updateGroup: vi.fn(),
        getGroupItems: vi.fn(),
        deleteGroupItem: vi.fn(),
        addGroupItem: vi.fn(),
      },
      transactionDrafts: {
        addDraft: vi.fn(async () => ({ id: `new-draft-${addedDraftSeq++}` })),
        updateDraft: vi.fn(),
      },
    };
    (window as any).electronAPI = { local: api };
    vi.mocked(deleteDraft).mockClear();
  });

  test('reconciles a mid-list insert by replacing the whole set instead of matching by index', async () => {
    // Persisted group had two draft-backed items at seq 0 and 1.
    api.transactionGroups.getGroupItems.mockResolvedValue([
      { transaction_group_id: 'g-1', seq: '0', transaction_draft_id: 'draft-A' },
      { transaction_group_id: 'g-1', seq: '1', transaction_draft_id: 'draft-B' },
    ]);

    // In memory: a NEW untagged item was inserted between the two loaded ones,
    // so order/seq no longer line up with the persisted rows.
    const items: StoreGroupItem[] = [
      storeItem({ seq: '0', groupId: 'g-1', description: 'A' }),
      storeItem({ seq: '1', description: 'C-new' }),
      storeItem({ seq: '2', groupId: 'g-1', description: 'B' }),
    ];

    await expect(updateGroup('g-1', 'user-1', { description: 'd' }, items)).resolves.toBeUndefined();

    // Both previously persisted drafts are removed (none orphaned, none wrongly kept).
    expect(deleteDraft).toHaveBeenCalledWith('draft-A');
    expect(deleteDraft).toHaveBeenCalledWith('draft-B');
    expect(api.transactionGroups.deleteGroupItem).toHaveBeenCalledWith('g-1', '0');
    expect(api.transactionGroups.deleteGroupItem).toHaveBeenCalledWith('g-1', '1');

    // All three current items are recreated with contiguous seq matching order.
    expect(api.transactionGroups.addGroupItem).toHaveBeenCalledTimes(3);
    const seqs = api.transactionGroups.addGroupItem.mock.calls.map((c: any[]) => c[0].seq);
    expect(seqs).toEqual(['0', '1', '2']);
    // It never tries to update a draft in place (the path that read the wrong row).
    expect(api.transactionDrafts.updateDraft).not.toHaveBeenCalled();
  });

  test('replaces every row when the items are only reordered (no insert/remove)', async () => {
    // Persisted group had three draft-backed items at seq 0, 1, 2 (A, B, C).
    api.transactionGroups.getGroupItems.mockResolvedValue([
      { transaction_group_id: 'g-1', seq: '0', transaction_draft_id: 'draft-A' },
      { transaction_group_id: 'g-1', seq: '1', transaction_draft_id: 'draft-B' },
      { transaction_group_id: 'g-1', seq: '2', transaction_draft_id: 'draft-C' },
    ]);

    // In memory: the same three items, just reordered to C, A, B. A reorder
    // can shift the validStart of many items, so we still drop and recreate all.
    const items: StoreGroupItem[] = [
      storeItem({ seq: '0', groupId: 'g-1', description: 'C' }),
      storeItem({ seq: '1', groupId: 'g-1', description: 'A' }),
      storeItem({ seq: '2', groupId: 'g-1', description: 'B' }),
    ];

    await updateGroup('g-1', 'user-1', { description: 'd' }, items);

    // All previously persisted drafts and rows are removed.
    expect(deleteDraft).toHaveBeenCalledWith('draft-A');
    expect(deleteDraft).toHaveBeenCalledWith('draft-B');
    expect(deleteDraft).toHaveBeenCalledWith('draft-C');
    expect(api.transactionGroups.deleteGroupItem).toHaveBeenCalledTimes(3);

    // All three are recreated in the new order with contiguous seq.
    expect(api.transactionGroups.addGroupItem).toHaveBeenCalledTimes(3);
    const seqs = api.transactionGroups.addGroupItem.mock.calls.map((c: any[]) => c[0].seq);
    expect(seqs).toEqual(['0', '1', '2']);
    expect(api.transactionDrafts.updateDraft).not.toHaveBeenCalled();
  });

  test('removes persisted rows that no longer exist in the current list', async () => {
    api.transactionGroups.getGroupItems.mockResolvedValue([
      { transaction_group_id: 'g-1', seq: '0', transaction_draft_id: 'draft-A' },
      { transaction_group_id: 'g-1', seq: '1', transaction_draft_id: 'draft-B' },
      { transaction_group_id: 'g-1', seq: '2', transaction_draft_id: 'draft-C' },
    ]);

    const items: StoreGroupItem[] = [storeItem({ seq: '0', groupId: 'g-1', description: 'A' })];

    await updateGroup('g-1', 'user-1', { description: 'd' }, items);

    expect(deleteDraft).toHaveBeenCalledTimes(3);
    expect(api.transactionGroups.addGroupItem).toHaveBeenCalledTimes(1);
    expect(api.transactionGroups.addGroupItem.mock.calls[0][0].seq).toBe('0');
  });
});
