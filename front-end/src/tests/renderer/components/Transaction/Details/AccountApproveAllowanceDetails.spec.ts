// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import {
  AccountAllowanceApproveTransaction,
  AccountId,
  NftId,
  TokenId,
  Transaction,
  Timestamp,
  TransactionId,
} from '@hiero-ledger/sdk';

import AccountApproveAllowanceDetails from '@renderer/components/Transaction/Details/AccountApproveAllowanceDetails.vue';

vi.mock('@renderer/utils', () => ({
  getAccountIdWithChecksum: (id: string) => id,
  getAccountNicknameFromId: async () => null,
  stringifyHbar: (hbar: { toString: () => string }) => hbar.toString(),
}));

const nodeAccount = new AccountId(0, 0, 3);
const payerAccount = new AccountId(0, 0, 2);
const validStart = Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));

const roundTrip = (configure: (tx: AccountAllowanceApproveTransaction) => void): AccountAllowanceApproveTransaction => {
  const tx = new AccountAllowanceApproveTransaction()
    .setNodeAccountIds([nodeAccount])
    .setTransactionId(TransactionId.withValidStart(payerAccount, validStart));
  configure(tx);
  const parsed = Transaction.fromBytes(tx.freeze().toBytes());
  if (!(parsed instanceof AccountAllowanceApproveTransaction)) {
    throw new Error('round-trip did not produce an AccountAllowanceApproveTransaction');
  }
  return parsed;
};

const mountWith = (transaction: Transaction) =>
  mount(AccountApproveAllowanceDetails, { props: { transaction } });

/**
 * Regression tests for the NFT allowance display bug reported in the security
 * review: tokenNftApprovals was never iterated in the template, and the heading
 * guarded against tokenApprovals.length instead of tokenNftApprovals.length,
 * so signers were presented with a blank panel while an NFT approval sat hidden.
 *
 * Each test round-trips the transaction through bytes to match what the details
 * view actually receives in production (transactions are reconstructed from
 * server-stored bytes, not the in-memory builders).
 */
describe('AccountApproveAllowanceDetails.vue', () => {
  describe('NFT allowance display', () => {
    it('renders the NFT section heading when tokenNftApprovals is non-empty', () => {
      const tx = roundTrip(t =>
        t.approveTokenNftAllowance(NftId.fromString('0.0.100/3'), new AccountId(1), new AccountId(5)),
      );

      expect(mountWith(tx).text()).toContain('Token NFT approvals');
    });

    it('does NOT render the NFT heading when tokenNftApprovals is empty', () => {
      const tx = roundTrip(() => {});

      expect(mountWith(tx).text()).not.toContain('Token NFT approvals');
    });

    it('renders the NFT section even when no HBAR approvals are present (the hidden-approval scenario)', () => {
      const tx = roundTrip(t =>
        t.approveTokenNftAllowanceAllSerials(TokenId.fromString('0.0.200'), new AccountId(1), new AccountId(5)),
      );

      const wrapper = mountWith(tx);
      expect(wrapper.text()).toContain('Token NFT approvals');
      expect(wrapper.text()).not.toContain('Hbar approvals');
    });

    it('renders owner ID, spender ID, and token ID', () => {
      const tx = roundTrip(t =>
        t.approveTokenNftAllowance(NftId.fromString('0.0.100/3'), new AccountId(1), new AccountId(5)),
      );

      const wrapper = mountWith(tx);
      expect(wrapper.find('[data-testid="p-account-approve-nft-details-owner-id"]').text()).toBe('0.0.1');
      expect(wrapper.find('[data-testid="p-account-approve-nft-details-spender-id"]').text()).toBe('0.0.5');
      expect(wrapper.find('[data-testid="p-account-approve-nft-details-token-id"]').text()).toBe('0.0.100');
    });

    it('renders specific serial numbers', () => {
      const tx = roundTrip(t => {
        t.approveTokenNftAllowance(NftId.fromString('0.0.100/3'), new AccountId(1), new AccountId(5));
        t.approveTokenNftAllowance(NftId.fromString('0.0.100/7'), new AccountId(1), new AccountId(5));
      });

      const serialsText = mountWith(tx).find('[data-testid="p-account-approve-nft-details-serials"]').text();
      expect(serialsText).toContain('3');
      expect(serialsText).toContain('7');
    });

    it('renders "All serials" for an approveForAll grant (serialNumbers is null after round-trip)', () => {
      const tx = roundTrip(t =>
        t.approveTokenNftAllowanceAllSerials(TokenId.fromString('0.0.200'), new AccountId(1), new AccountId(5)),
      );

      // After deserialization serialNumbers is null, not []. Verify the template
      // handles this via the allSerials flag rather than the serialNumbers array.
      expect(tx.tokenNftApprovals[0].serialNumbers).toBeNull();
      expect(mountWith(tx).find('[data-testid="p-account-approve-nft-details-serials"]').text()).toBe('All serials');
    });
  });
});
