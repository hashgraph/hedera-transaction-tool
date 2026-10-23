// @vitest-environment happy-dom
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { ref } from 'vue';

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  getGroupStatus: vi.fn(),
  getGroup: vi.fn(),
  loaded: vi.fn(),
}));

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({
    selectedOrganization: {
      serverUrl: 'https://org.test',
      admin: false,
      userKeys: [{ id: 1, publicKey: 'pk' }],
    },
  }),
}));
vi.mock('@renderer/composables/useTransactionAudit.ts', () => ({
  default: () => ({
    transaction: {
      get value() {
        return mocks.loaded();
      },
    },
    sdkTransaction: ref(null),
    externalSignerKeys: ref(new Set()),
  }),
}));
vi.mock('@renderer/composables/useFilterNotifications.ts', () => ({
  default: () => ({ filteredNotificationIds: ref([]) }),
}));
vi.mock('@renderer/services/organization', () => ({ getTransactionGroupById: mocks.getGroup }));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  isLoggedInOrganization: vi.fn(() => true),
  getCreatorSignatureStatus: mocks.getStatus,
  getGroupCreatorSignatureStatus: mocks.getGroupStatus,
}));

import TransactionNodeRow from '@renderer/pages/Transactions/components/TransactionNodeRow.vue';
import {
  type ITransactionNode,
  TransactionNodeCollection,
} from '@shared/interfaces/ITransactionNode.ts';

const keys = [{ id: 1, publicKey: 'pk' }];
const baseNode: ITransactionNode = {
  description: 'd',
  createdAt: '2030-01-01T00:00:00Z',
  validStart: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
};
const pillTestId = 'span-transaction-node-creator-signature-0';

async function render(
  node: Partial<ITransactionNode>,
  collection = TransactionNodeCollection.READY_TO_SIGN,
) {
  const wrapper = mount(TransactionNodeRow, {
    props: { collection, node: { ...baseNode, ...node }, index: 0 },
    global: {
      stubs: {
        TransactionId: true,
        DateTimeString: true,
        AppButton: true,
        SignSingleButton: true,
        SignGroupButton: true,
        // Surfaces the props the row passes in
        CreatorSignaturePill: {
          props: { status: String, group: Boolean },
          template: '<span :data-status="status" :data-group="String(group)" />',
        },
      },
    },
  });
  await flushPromises();
  return wrapper;
}

const pill = (wrapper: Awaited<ReturnType<typeof render>>) =>
  wrapper.get(`[data-testid="${pillTestId}"]`);

describe('TransactionNodeRow.vue creator signature pill', () => {
  beforeEach(() => {
    mocks.getStatus.mockReset().mockReturnValue('unverifiable');
    mocks.getGroupStatus.mockReset().mockReturnValue('data-missing');
    mocks.getGroup.mockReset().mockResolvedValue({ groupItems: [] });
    mocks.loaded.mockReset().mockReturnValue({ id: 5 });
  });

  test('checks a single transaction against the own keys', async () => {
    const wrapper = await render({ transactionId: 5 });

    expect(mocks.getStatus).toHaveBeenCalledWith({ id: 5 }, keys);
    expect(pill(wrapper).attributes('data-status')).toBe('unverifiable');
    expect(pill(wrapper).attributes('data-group')).toBe('false');
  });

  test('fetches the group and reports its worst status', async () => {
    const group = { groupItems: [] };
    mocks.getGroup.mockResolvedValue(group);
    const wrapper = await render({ groupId: 9 });

    expect(mocks.getGroup).toHaveBeenCalledWith('https://org.test', 9);
    expect(mocks.getGroupStatus).toHaveBeenCalledWith(group, keys);
    expect(pill(wrapper).attributes('data-status')).toBe('data-missing');
    expect(pill(wrapper).attributes('data-group')).toBe('true');
  });

  test('stays verified when the group cannot be fetched', async () => {
    mocks.getGroup.mockRejectedValue(new Error('network'));
    const wrapper = await render({ groupId: 9 });

    expect(pill(wrapper).attributes('data-status')).toBe('verified');
  });

  test.each([null, new Error('failed to load')])(
    'stays verified when the transaction could not be loaded (%s)',
    async loaded => {
      mocks.loaded.mockReturnValue(loaded);
      const wrapper = await render({ transactionId: 5 });

      expect(mocks.getStatus).not.toHaveBeenCalled();
      expect(pill(wrapper).attributes('data-status')).toBe('verified');
    },
  );

  test.each([
    TransactionNodeCollection.READY_FOR_REVIEW,
    TransactionNodeCollection.READY_FOR_EXECUTION,
    TransactionNodeCollection.IN_PROGRESS,
    TransactionNodeCollection.HISTORY,
  ])('is not checked outside Ready to Sign (%s)', async collection => {
    const wrapper = await render({ transactionId: 5 }, collection);

    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(mocks.getGroup).not.toHaveBeenCalled();
    expect(pill(wrapper).attributes('data-status')).toBe('verified');
  });
});
