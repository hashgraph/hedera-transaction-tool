// @vitest-environment happy-dom
import { describe, expect, test, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { AccountCreateTransaction } from '@hiero-ledger/sdk';
import type { IGroupItem } from '@renderer/services/organization/transactionGroup';
import { TransactionStatus, BackEndTransactionType } from '@shared/interfaces';

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  isLoggedIn: vi.fn(),
}));

const userKeys = [{ id: 1, publicKey: 'pk' }];

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({ selectedOrganization: { userKeys } }),
}));
vi.mock('@renderer/stores/storeNetwork.ts', () => ({ default: () => ({}) }));
vi.mock('@renderer/caches/AppCache.ts', () => ({ AppCache: { inject: () => ({}) } }));
vi.mock('@renderer/composables/useRevealed.ts', () => ({ default: vi.fn() }));
vi.mock('@renderer/utils', async importOriginal => ({
  ...(await importOriginal<typeof import('@renderer/utils')>()),
  isLoggedInOrganization: mocks.isLoggedIn,
  getCreatorSignatureStatus: mocks.getStatus,
}));

import TransactionGroupRow from '@renderer/pages/TransactionGroupDetails/TransactionGroupRow.vue';

const item = {
  seq: 0,
  transactionId: 1,
  transaction: {
    id: 1,
    type: BackEndTransactionType.ACCOUNT_CREATE,
    transactionBytes: Buffer.from(new AccountCreateTransaction().toBytes()).toString('hex'),
    status: TransactionStatus.WAITING_FOR_SIGNATURES,
    validStart: '2030-01-01T00:00:00Z',
  },
} as IGroupItem;

const render = () =>
  mount(TransactionGroupRow, {
    props: { groupItem: item, rowIndex: 0 },
    global: {
      stubs: {
        TransactionId: true,
        DateTimeString: true,
        SignSingleButton: true,
        AppButton: true,
        CreatorSignaturePill: {
          props: { status: String },
          template: '<span data-testid="pill" :data-status="status" />',
        },
      },
    },
  });

describe('TransactionGroupRow creator signature pill', () => {
  beforeEach(() => {
    mocks.getStatus.mockReset().mockReturnValue('unverifiable');
    mocks.isLoggedIn.mockReset().mockReturnValue(true);
  });

  test("passes the row's transaction status check to the pill", () => {
    const wrapper = render();

    expect(mocks.getStatus).toHaveBeenCalledWith(item.transaction, userKeys);
    expect(wrapper.get('[data-testid="pill"]').attributes('data-status')).toBe('unverifiable');
  });

  test('does not check, and shows verified, outside an organization', () => {
    mocks.isLoggedIn.mockReturnValue(false);
    const wrapper = render();

    expect(mocks.getStatus).not.toHaveBeenCalled();
    expect(wrapper.get('[data-testid="pill"]').attributes('data-status')).toBe('verified');
  });
});
