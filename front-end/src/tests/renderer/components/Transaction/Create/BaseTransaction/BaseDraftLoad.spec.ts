// @vitest-environment happy-dom
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import {
  FileAppendTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
} from '@hiero-ledger/sdk';

const mocks = vi.hoisted(() => ({
  routeQuery: {} as Record<string, string | undefined>,
  groupItems: [] as Array<{ transactionBytes: Uint8Array }>,
  getDraft: vi.fn(),
  getTransactionFromBytes: vi.fn(),
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: mocks.routeQuery }),
}));

vi.mock('@renderer/stores/storeTransactionGroup', () => ({
  default: () => ({ groupItems: mocks.groupItems }),
}));

vi.mock('@renderer/services/transactionDraftsService', () => ({
  getDraft: mocks.getDraft,
}));

vi.mock('@renderer/utils', () => ({
  getTransactionFromBytes: mocks.getTransactionFromBytes,
}));

import BaseDraftLoad from '@renderer/components/Transaction/Create/BaseTransaction/BaseDraftLoad.vue';

function makeNonEmptyFileTransaction(
  TransactionType:
    | typeof FileAppendTransaction
    | typeof FileCreateTransaction
    | typeof FileUpdateTransaction,
): FileAppendTransaction | FileCreateTransaction | FileUpdateTransaction {
  const transaction = new TransactionType();
  transaction.setContents(new Uint8Array([1, 2, 3]));
  return transaction;
}

describe('BaseDraftLoad', () => {
  beforeEach(() => {
    mocks.routeQuery = {};
    mocks.groupItems = [];
    mocks.getDraft.mockReset();
    mocks.getTransactionFromBytes.mockReset();
  });

  test.each([
    ['FileCreateTransaction', FileCreateTransaction],
    ['FileUpdateTransaction', FileUpdateTransaction],
    ['FileAppendTransaction', FileAppendTransaction],
  ])('preserves non-empty %s contents when loading a draft', async (_label, TransactionType) => {
    const transaction = makeNonEmptyFileTransaction(TransactionType);
    const setContentsSpy = vi.spyOn(transaction, 'setContents');

    mocks.routeQuery = { draftId: 'draft-1' };
    mocks.getDraft.mockResolvedValue({ transactionBytes: '0x1234' });
    mocks.getTransactionFromBytes.mockReturnValue(transaction);

    const wrapper = mount(BaseDraftLoad);
    await flushPromises();

    expect(mocks.getDraft).toHaveBeenCalledWith('draft-1');
    expect(mocks.getTransactionFromBytes).toHaveBeenCalledWith('0x1234');
    expect(setContentsSpy).not.toHaveBeenCalled();
    expect(Array.from(transaction.contents ?? [])).toEqual([1, 2, 3]);
    expect(wrapper.emitted('draft-loaded')?.[0]).toEqual([transaction]);
  });
});
