// @vitest-environment happy-dom
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { computed, ref } from 'vue';

import { TransactionStatus } from '@shared/interfaces';
import { TransactionNodeCollection, type ITransactionNode } from '@shared/interfaces/ITransactionNode.ts';

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({ selectedOrganization: null }),
}));

vi.mock('@renderer/composables/useTransactionAudit.ts', () => ({
  default: () => ({
    transaction: computed(() => Promise.resolve(null)),
    sdkTransaction: computed(() => Promise.resolve(null)),
    signatureKey: computed(() => Promise.resolve(null)),
    externalSignerKeys: computed(() => Promise.resolve(new Set())),
  }),
}));

vi.mock('@renderer/composables/useFilterNotifications.ts', () => ({
  default: () => ({
    filteredNotifications: ref([]),
    filteredNotificationIds: computed(() => []),
  }),
}));

vi.mock('@renderer/utils', () => ({
  isLoggedInOrganization: vi.fn(() => false),
  getStatusFromCode: vi.fn(() => null),
}));

vi.mock('@renderer/utils/sdk/transactions.ts', () => ({
  getDisplayTransactionType: vi.fn(() => 'Crypto Transfer'),
}));

const baseNode: ITransactionNode = {
  description: 'A transaction',
  createdAt: '2030-01-01T00:00:00Z',
  validStart: '2030-01-01T00:00:00Z',
  updatedAt: '2030-01-01T00:00:00Z',
  transactionId: 1,
  sdkTransactionId: '0.0.1@123.0001',
  transactionType: 'CRYPTO_TRANSFER',
  status: TransactionStatus.WAITING_FOR_SIGNATURES,
};

const stubs = {
  TransactionId: true,
  DateTimeString: true,
  AppButton: true,
  SignSingleButton: true,
  SignGroupButton: true,
  CreatorSignaturePill: true,
};

async function mountRow(
  nodeOverrides: Partial<ITransactionNode> = {},
  reviewerEnabled = false,
  collection: TransactionNodeCollection = TransactionNodeCollection.READY_TO_SIGN,
) {
  if (reviewerEnabled) {
    vi.doMock('@shared/constants', async importOriginal => {
      const actual = await importOriginal<typeof import('@shared/constants')>();
      return { ...actual, FEATURE_REVIEWER_ENABLED: true };
    });
  } else {
    vi.doUnmock('@shared/constants');
  }

  const { default: TransactionNodeRow } = await import(
    '@renderer/pages/Transactions/components/TransactionNodeRow.vue'
  );

  return mount(TransactionNodeRow, {
    props: {
      collection,
      node: { ...baseNode, ...nodeOverrides },
      index: 0,
    },
    global: { stubs },
  });
}

describe('TransactionNodeRow.vue badges', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test('shows the Pending Review badge when status is READY_FOR_REVIEW and the flag is on', async () => {
    const wrapper = await mountRow({ status: TransactionStatus.READY_FOR_REVIEW }, true);
    expect(wrapper.find('.badge.bg-warning').exists()).toBe(true);
    expect(wrapper.find('.badge.bg-warning').text()).toBe('Pending Review');
  });

  test.each([TransactionNodeCollection.READY_FOR_REVIEW, TransactionNodeCollection.IN_PROGRESS])(
    'omits the Pending Review badge outside Ready to Sign (%s)',
    async collection => {
      const wrapper = await mountRow({ status: TransactionStatus.READY_FOR_REVIEW }, true, collection);
      expect(wrapper.find('.badge.bg-warning').exists()).toBe(false);
    },
  );

  test('omits the Pending Review badge for other statuses', async () => {
    const wrapper = await mountRow({ status: TransactionStatus.WAITING_FOR_SIGNATURES }, true);
    expect(wrapper.find('.badge.bg-warning').exists()).toBe(false);
  });

  test('shows the Rejected badge when hasRejection is true and the flag is on', async () => {
    const wrapper = await mountRow({ hasRejection: true }, true);
    expect(wrapper.find('.badge.bg-danger').exists()).toBe(true);
    expect(wrapper.find('.badge.bg-danger').text()).toBe('Rejected');
  });

  test('omits the Rejected badge when hasRejection is false or undefined', async () => {
    expect((await mountRow({ hasRejection: false }, true)).find('.badge.bg-danger').exists()).toBe(
      false,
    );
    expect((await mountRow({ hasRejection: undefined }, true)).find('.badge.bg-danger').exists()).toBe(
      false,
    );
  });

  test('omits both badges when the flag is off regardless of status/hasRejection', async () => {
    const wrapper = await mountRow(
      { status: TransactionStatus.READY_FOR_REVIEW, hasRejection: true },
      false,
    );
    expect(wrapper.find('.badge.bg-warning').exists()).toBe(false);
    expect(wrapper.find('.badge.bg-danger').exists()).toBe(false);
  });
});
