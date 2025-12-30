import { AccountAllowanceApproveTransaction, AccountId, TokenId, Hbar, NftId } from '@hashgraph/sdk';
import { AccountAllowanceApproveTransactionModel } from './account-allowance-approve-transaction.model';

describe('AccountAllowanceApproveTransactionModel', () => {
  let mockTransaction: AccountAllowanceApproveTransaction;

  beforeEach(() => {
    mockTransaction = new AccountAllowanceApproveTransaction();
  });

  describe('TRANSACTION_TYPE', () => {
    it('should have the correct transaction type', () => {
      expect(AccountAllowanceApproveTransactionModel.TRANSACTION_TYPE).toBe(
        'AccountAllowanceApproveTransaction'
      );
    });
  });

  describe('getSigningAccounts', () => {
    it('should return empty set when no approvals are set', () => {
      const model = new AccountAllowanceApproveTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });

    it('should return owner account from hbar approvals', () => {
      const owner = AccountId.fromString('0.0.100');
      const spender = AccountId.fromString('0.0.200');

      mockTransaction.approveHbarAllowance(owner, spender, Hbar.fromTinybars(10));

      const model = new AccountAllowanceApproveTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(1);
      expect(result.has('0.0.100')).toBe(true);
    });

    it('should return owner account from token approvals', () => {
      const owner = AccountId.fromString('0.0.300');
      const spender = AccountId.fromString('0.0.400');
      const tokenId = TokenId.fromString('0.0.500');

      mockTransaction.approveTokenAllowance(tokenId, owner, spender, 100);

      const model = new AccountAllowanceApproveTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(1);
      expect(result.has('0.0.300')).toBe(true);
    });

    it('should return owner account from token NFT approvals', () => {
      const owner = AccountId.fromString('0.0.600');
      const spender = AccountId.fromString('0.0.700');
      const nftId = new NftId(TokenId.fromString('0.0.800'), 1);

      mockTransaction.approveTokenNftAllowance(nftId, owner, spender);

      const model = new AccountAllowanceApproveTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(1);
      expect(result.has('0.0.600')).toBe(true);
    });

    it('should return all unique owner accounts from multiple approval types', () => {
      const owner1 = AccountId.fromString('0.0.100');
      const owner2 = AccountId.fromString('0.0.200');
      const owner3 = AccountId.fromString('0.0.300');
      const spender = AccountId.fromString('0.0.999');
      const tokenId = TokenId.fromString('0.0.500');
      const nftId = new NftId(TokenId.fromString('0.0.600'), 1);

      mockTransaction.approveHbarAllowance(owner1, spender, Hbar.fromTinybars(10));
      mockTransaction.approveTokenAllowance(tokenId, owner2, spender, 100);
      mockTransaction.approveTokenNftAllowance(nftId, owner3, spender);

      const model = new AccountAllowanceApproveTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(3);
      expect(result.has('0.0.100')).toBe(true);
      expect(result.has('0.0.200')).toBe(true);
      expect(result.has('0.0.300')).toBe(true);
    });

    it('should deduplicate owner accounts across approval types', () => {
      const owner = AccountId.fromString('0.0.100');
      const spender = AccountId.fromString('0.0.999');
      const tokenId = TokenId.fromString('0.0.500');
      const nftId = new NftId(TokenId.fromString('0.0.600'), 1);

      mockTransaction.approveHbarAllowance(owner, spender, Hbar.fromTinybars(10));
      mockTransaction.approveTokenAllowance(tokenId, owner, spender, 100);
      mockTransaction.approveTokenNftAllowance(nftId, owner, spender);

      const model = new AccountAllowanceApproveTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(1);
      expect(result.has('0.0.100')).toBe(true);
    });

    it('should handle multiple approvals of the same type', () => {
      const owner1 = AccountId.fromString('0.0.100');
      const owner2 = AccountId.fromString('0.0.200');
      const spender = AccountId.fromString('0.0.999');

      mockTransaction.approveHbarAllowance(owner1, spender, Hbar.fromTinybars(10));
      mockTransaction.approveHbarAllowance(owner2, spender, Hbar.fromTinybars(20));

      const model = new AccountAllowanceApproveTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result.size).toBe(2);
      expect(result.has('0.0.100')).toBe(true);
      expect(result.has('0.0.200')).toBe(true);
    });
  });
});
