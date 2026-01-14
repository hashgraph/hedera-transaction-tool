import { AccountDeleteTransaction, AccountId } from '@hashgraph/sdk';
import { AccountDeleteTransactionModel } from './account-delete-transaction.model';

describe('AccountDeleteTransactionModel', () => {
  let mockTransaction: AccountDeleteTransaction;

  beforeEach(() => {
    mockTransaction = new AccountDeleteTransaction();
  });

  describe('TRANSACTION_TYPE', () => {
    it('should have the correct transaction type', () => {
      expect(AccountDeleteTransactionModel.TRANSACTION_TYPE).toBe('AccountDeleteTransaction');
    });
  });

  describe('getSigningAccounts', () => {
    it('should return a set with the account ID when accountId is set', () => {
      const accountId = AccountId.fromString('0.0.123');
      mockTransaction.setAccountId(accountId);

      const model = new AccountDeleteTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('0.0.123')).toBe(true);
    });

    it('should return an empty set when accountId is not set', () => {
      const model = new AccountDeleteTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('getReceiverAccounts', () => {
    it('should return a set with the transfer account ID when transferAccountId is set', () => {
      const transferAccountId = AccountId.fromString('0.0.456');
      mockTransaction.setTransferAccountId(transferAccountId);

      const model = new AccountDeleteTransactionModel(mockTransaction);
      const result = model.getReceiverAccounts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(1);
      expect(result.has('0.0.456')).toBe(true);
    });

    it('should return an empty set when transferAccountId is not set', () => {
      const model = new AccountDeleteTransactionModel(mockTransaction);
      const result = model.getReceiverAccounts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });
});