import { AccountId, TransferTransaction, Transaction as SDKTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';

// Concrete implementation for testing
class TestTransactionModel extends TransactionBaseModel<SDKTransaction> {
  constructor(transaction: SDKTransaction) {
    super(transaction);
  }
}

describe('TransactionBaseModel', () => {
  let mockTransaction: SDKTransaction;

  beforeEach(() => {
    mockTransaction = new TransferTransaction();
  });

  describe('getFeePayerAccountId', () => {
    it('should return the account ID when transactionId has accountId', () => {
      const accountId = AccountId.fromString('0.0.123');
      mockTransaction.setTransactionId({
        accountId,
        validStart: null,
      } as any);

      const model = new TestTransactionModel(mockTransaction);
      const result = model.getFeePayerAccountId();

      expect(result).toEqual(accountId);
    });

    it('should return null when transactionId is undefined', () => {
      const model = new TestTransactionModel(mockTransaction);
      const result = model.getFeePayerAccountId();

      expect(result).toBeNull();
    });

    it('should return null when transactionId.accountId is undefined', () => {
      mockTransaction.setTransactionId({
        validStart: null,
      } as any);

      const model = new TestTransactionModel(mockTransaction);
      const result = model.getFeePayerAccountId();

      expect(result).toBeNull();
    });
  });

  describe('getSigningAccounts', () => {
    it('should return an empty Set', () => {
      const model = new TestTransactionModel(mockTransaction);
      const result = model.getSigningAccounts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('getReceiverAccounts', () => {
    it('should return an empty Set', () => {
      const model = new TestTransactionModel(mockTransaction);
      const result = model.getReceiverAccounts();

      expect(result).toBeInstanceOf(Set);
      expect(result.size).toBe(0);
    });
  });

  describe('getNewKeys', () => {
    it('should return an empty array', () => {
      const model = new TestTransactionModel(mockTransaction);
      const result = model.getNewKeys();

      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('getNodeId', () => {
    it('should return null', () => {
      const model = new TestTransactionModel(mockTransaction);
      const result = model.getNodeId();

      expect(result).toBeNull();
    });
  });
});