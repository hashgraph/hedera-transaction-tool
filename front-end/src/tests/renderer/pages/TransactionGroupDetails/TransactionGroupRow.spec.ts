// @vitest-environment happy-dom
import { describe, expect, test, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import {
  AccountCreateTransaction,
  Hbar,
  Transaction,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import type { IGroupItem } from '@renderer/services/organization/transactionGroup';
import { TransactionStatus, BackEndTransactionType } from '@shared/interfaces';
import TransactionGroupRow from '@renderer/pages/TransactionGroupDetails/TransactionGroupRow.vue';

vi.mock('@renderer/stores/storeUser.ts', () => ({
  default: () => ({ selectedOrganization: null }),
}));
vi.mock('@renderer/stores/storeNetwork.ts', () => ({ default: () => ({}) }));
vi.mock('@renderer/caches/AppCache.ts', () => ({ AppCache: { inject: () => ({}) } }));
vi.mock('@renderer/composables/useRevealed.ts', () => ({ default: vi.fn() }));

const groupItem = (transaction: Transaction): IGroupItem =>
  ({
    seq: 0,
    transactionId: 1,
    transaction: {
      id: 1,
      type:
        transaction instanceof TransferTransaction
          ? BackEndTransactionType.TRANSFER
          : BackEndTransactionType.ACCOUNT_CREATE,
      transactionBytes: Buffer.from(transaction.toBytes()).toString('hex'),
      status: TransactionStatus.WAITING_FOR_SIGNATURES,
      validStart: '2030-01-01T00:00:00Z',
    },
  }) as IGroupItem;

const render = (transaction: Transaction) =>
  mount(TransactionGroupRow, {
    props: { groupItem: groupItem(transaction), rowIndex: 0 },
    global: {
      stubs: { TransactionId: true, DateTimeString: true, SignSingleButton: true, AppButton: true },
    },
  });
const transfer = (entries: [string, string][]) => {
  const transaction = new TransferTransaction();
  for (const [account, amount] of entries)
    transaction.addHbarTransfer(account, Hbar.fromTinybars(amount));
  return transaction;
};
const summary = (wrapper: ReturnType<typeof render>) =>
  wrapper.get('[data-testid="group-transfer-summary"]').text();

describe('group transfer summary', () => {
  test('places the sender first even when SDK ordering puts the receiver first', () => {
    const wrapper = render(
      transfer([
        ['0.0.1002', '-10'],
        ['0.0.2', '10'],
      ]),
    );
    expect(summary(wrapper)).toBe('0.0.1002 → 10 tℏ → 0.0.2');
  });

  test('shows the total credit and the number of additional recipients', () => {
    const wrapper = render(
      transfer([
        ['0.0.2', '-10'],
        ['0.0.1002', '3'],
        ['0.0.1003', '2'],
        ['0.0.1004', '5'],
      ]),
    );
    expect(summary(wrapper)).toBe('0.0.2 → 10 tℏ → 0.0.1002 and 2 other accounts');
  });

  test('shows Multiple transfers for multiple senders', () => {
    const wrapper = render(
      transfer([
        ['0.0.2', '-4'],
        ['0.0.3', '-6'],
        ['0.0.1002', '3'],
        ['0.0.1003', '7'],
      ]),
    );
    expect(summary(wrapper)).toBe('Multiple transfers');
  });

  test('preserves amounts above JavaScript safe integer precision', () => {
    const wrapper = render(
      transfer([
        ['0.0.2', '-9007199254740993'],
        ['0.0.3', '9007199254740993'],
      ]),
    );
    expect(summary(wrapper)).toBe('0.0.2 → 90071992.54740993 ℏ → 0.0.3');
  });

  test('does not show a misleading total for unbalanced transfers', () => {
    expect(
      summary(
        render(
          transfer([
            ['0.0.2', '-10'],
            ['0.0.3', '9'],
          ]),
        ),
      ),
    ).toBe('Unbalanced transfers');
  });

  test('updates when transaction bytes change', async () => {
    const wrapper = render(
      transfer([
        ['0.0.2', '-1'],
        ['0.0.3', '1'],
      ]),
    );
    await wrapper.setProps({
      groupItem: groupItem(
        transfer([
          ['0.0.2', '-5'],
          ['0.0.4', '5'],
        ]),
      ),
    });
    expect(summary(wrapper)).toBe('0.0.2 → 5 tℏ → 0.0.4');
  });

  test('identifies token and NFT transfers alongside the HBAR summary', () => {
    const transaction = transfer([
      ['0.0.2', '-10'],
      ['0.0.3', '10'],
    ])
      .addTokenTransfer('0.0.100', '0.0.2', -1)
      .addTokenTransfer('0.0.100', '0.0.3', 1)
      .addNftTransfer('0.0.101', 1, '0.0.2', '0.0.3');
    expect(summary(render(transaction))).toBe('0.0.2 → 10 tℏ → 0.0.3 · Token transfers · NFT transfers');
  });

  test('does not describe a token-only transaction as having no transfers', () => {
    const transaction = new TransferTransaction()
      .addTokenTransfer('0.0.100', '0.0.2', -1)
      .addTokenTransfer('0.0.100', '0.0.3', 1);
    expect(summary(render(transaction))).toBe('Token transfers');
  });

  test('omits transfer summaries for other transaction types', () => {
    expect(
      render(new AccountCreateTransaction())
        .find('[data-testid="group-transfer-summary"]')
        .exists(),
    ).toBe(false);
  });

  test('shows a fallback if bytes cannot be decoded', async () => {
    const wrapper = render(new AccountCreateTransaction());
    const item = groupItem(new AccountCreateTransaction());
    item.transaction.transactionBytes = 'ff';
    await wrapper.setProps({ groupItem: item });
    expect(summary(wrapper)).toBe('Summary unavailable — see details');
  });
});
