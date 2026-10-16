// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { AccountId, Hbar, KeyList, Timestamp, TransactionId, TransferTransaction } from '@hiero-ledger/sdk';

import BaseGroupHandler from '@renderer/components/Transaction/Create/BaseTransaction/BaseGroupHandler.vue';

function createTransferTransaction() {
  return new TransferTransaction()
    .setMaxTransactionFee(new Hbar(2))
    .setTransactionId(
      TransactionId.withValidStart(AccountId.fromString('0.0.2'), Timestamp.fromDate(new Date())),
    );
}

const mocks = vi.hoisted(() => ({
  route: {
    query: { groupIndex: undefined as string | undefined },
    params: { seq: undefined as string[] | undefined },
  },
  routerPush: vi.fn(),
  groupStore: {
    groupItems: [] as { groupId?: string; isManual?: boolean }[],
    addGroupItem: vi.fn(),
    editGroupItem: vi.fn(),
  },
}));

vi.mock('vue-router', () => ({
  useRoute: vi.fn(() => mocks.route),
  useRouter: vi.fn(() => ({
    currentRoute: { value: mocks.route },
    push: mocks.routerPush,
  })),
}));

vi.mock('@renderer/stores/storeTransactionGroup', () => ({
  default: vi.fn(() => mocks.groupStore),
}));

vi.mock('@renderer/services/keyPairService', () => ({
  flattenKeyList: vi.fn(() => []),
}));

vi.mock('@renderer/utils/sdk/transactions', () => ({
  getTransactionType: vi.fn(() => 'Transfer Transaction'),
}));

function mountHandler() {
  return mount(BaseGroupHandler, {
    props: {
      createTransaction: createTransferTransaction,
      baseline: null,
      transactionKey: new KeyList(),
    },
  });
}

describe('BaseGroupHandler.vue', () => {
  beforeEach(() => {
    mocks.route.query = { groupIndex: undefined };
    mocks.route.params = { seq: undefined };
    mocks.routerPush.mockReset();
    mocks.groupStore.groupItems = [];
    mocks.groupStore.addGroupItem.mockReset();
    mocks.groupStore.editGroupItem.mockReset();
  });

  test('passes isManual through to the store when adding a group item', () => {
    const wrapper = mountHandler();

    (wrapper.vm as { addGroupItem: (...args: unknown[]) => void }).addGroupItem(
      'description',
      '0.0.2',
      new Date(),
      [],
      [],
      true,
    );

    expect(mocks.groupStore.addGroupItem).toHaveBeenCalledWith(
      expect.objectContaining({ isManual: true }),
    );
  });

  test('passes isManual through to the store when editing a group item', () => {
    mocks.route.params = { seq: ['0'] };
    mocks.groupStore.groupItems = [{ groupId: 'group-1', isManual: true }];

    const wrapper = mountHandler();

    (wrapper.vm as { editGroupItem: (...args: unknown[]) => void }).editGroupItem(
      'description',
      '0.0.2',
      new Date(),
      [],
      [],
      false,
    );

    expect(mocks.groupStore.editGroupItem).toHaveBeenCalledWith(
      expect.objectContaining({ isManual: false }),
    );
  });

  test('emits fetchedIsManual with the existing item isManual value when editing', () => {
    mocks.route.query = { groupIndex: '0' };
    mocks.groupStore.groupItems = [{ isManual: true }];

    const wrapper = mountHandler();

    expect(wrapper.emitted('fetchedIsManual')).toEqual([[true]]);
  });

  test('emits fetchedIsManual with false when the existing item has no isManual flag', () => {
    mocks.route.query = { groupIndex: '0' };
    mocks.groupStore.groupItems = [{}];

    const wrapper = mountHandler();

    expect(wrapper.emitted('fetchedIsManual')).toEqual([[false]]);
  });

  test('does not emit fetchedIsManual when adding a brand new item', () => {
    const wrapper = mountHandler();

    expect(wrapper.emitted('fetchedIsManual')).toBeUndefined();
  });
});
