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

const buildTx = () =>
  new AccountAllowanceApproveTransaction()
    .setNodeAccountIds([nodeAccount])
    .setTransactionId(TransactionId.withValidStart(payerAccount, validStart));

const mountWith = (transaction: Transaction) =>
  mount(AccountApproveAllowanceDetails, { props: { transaction } });

/**
 * Regression tests for the NFT allowance display bug reported in the security
 * review: tokenNftApprovals was never iterated in the template, and the heading
 * guarded against tokenApprovals.length instead of tokenNftApprovals.length,
 * so signers were presented with a blank panel while an NFT approval sat hidden.
 */
describe('AccountApproveAllowanceDetails.vue', () => {
  describe('NFT allowance display', () => {
    it('renders the NFT section heading when tokenNftApprovals is non-empty', () => {
      const tx = buildTx();
      tx.approveTokenNftAllowance(NftId.fromString('0.0.100/3'), new AccountId(1), new AccountId(5));

      const wrapper = mountWith(tx);

      expect(wrapper.text()).toContain('Token NFT approvals');
    });

    it('does NOT render the NFT heading when tokenNftApprovals is empty', () => {
      const tx = buildTx();

      const wrapper = mountWith(tx);

      expect(wrapper.text()).not.toContain('Token NFT approvals');
    });

    it('renders the NFT section even when no HBAR approvals are present (the hidden-approval scenario)', () => {
      const tx = buildTx();
      tx.approveTokenNftAllowanceAllSerials(TokenId.fromString('0.0.200'), new AccountId(1), new AccountId(5));

      const wrapper = mountWith(tx);

      expect(wrapper.text()).toContain('Token NFT approvals');
      expect(wrapper.text()).not.toContain('Hbar approvals');
    });

    it('renders owner ID, spender ID, and token ID', () => {
      const tx = buildTx();
      tx.approveTokenNftAllowance(NftId.fromString('0.0.100/3'), new AccountId(1), new AccountId(5));

      const wrapper = mountWith(tx);

      expect(wrapper.find('[data-testid="p-account-approve-nft-details-owner-id"]').text()).toBe('0.0.1');
      expect(wrapper.find('[data-testid="p-account-approve-nft-details-spender-id"]').text()).toBe('0.0.5');
      expect(wrapper.find('[data-testid="p-account-approve-nft-details-token-id"]').text()).toBe('0.0.100');
    });

    it('renders specific serial numbers', () => {
      const tx = buildTx();
      tx.approveTokenNftAllowance(NftId.fromString('0.0.100/3'), new AccountId(1), new AccountId(5));
      tx.approveTokenNftAllowance(NftId.fromString('0.0.100/7'), new AccountId(1), new AccountId(5));

      const wrapper = mountWith(tx);

      const serialsText = wrapper.find('[data-testid="p-account-approve-nft-details-serials"]').text();
      expect(serialsText).toContain('3');
      expect(serialsText).toContain('7');
    });

    it('renders "All serials" for an approveForAll grant', () => {
      const tx = buildTx();
      tx.approveTokenNftAllowanceAllSerials(TokenId.fromString('0.0.200'), new AccountId(1), new AccountId(5));

      const wrapper = mountWith(tx);

      expect(wrapper.find('[data-testid="p-account-approve-nft-details-serials"]').text()).toBe('All serials');
    });
  });
});
