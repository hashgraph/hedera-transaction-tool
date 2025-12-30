import { TransferTransaction } from '@hashgraph/sdk';
import { TransferTransactionModel } from './transfer-transaction.model';

describe('TransferTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(TransferTransactionModel.TRANSACTION_TYPE).toBe('TransferTransaction');
  });

  describe('getSigningAccounts', () => {
    it('should return accounts with negative amount and not approved', () => {
      const tx = {
        hbarTransfersList: [
          { accountId: { toString: () => '1' }, amount: { isNegative: () => true }, isApproved: false },
          { accountId: { toString: () => '2' }, amount: { isNegative: () => true }, isApproved: true },
          { accountId: { toString: () => '3' }, amount: { isNegative: () => false }, isApproved: false },
        ],
      } as unknown as TransferTransaction;

      const model = new TransferTransactionModel(tx);
      const accounts = model.getSigningAccounts();

      expect(accounts).toEqual(new Set(['1']));
    });

    it('should return empty set if no transfers meet criteria', () => {
      const tx = {
        hbarTransfersList: [
          { accountId: { toString: () => '1' }, amount: { isNegative: () => false }, isApproved: false },
        ],
      } as unknown as TransferTransaction;

      const model = new TransferTransactionModel(tx);
      const accounts = model.getSigningAccounts();

      expect(accounts.size).toBe(0);
    });
  });

  describe('getReceiverAccounts', () => {
    it('should return accounts with non-negative amounts', () => {
      const tx = {
        hbarTransfersList: [
          { accountId: { toString: () => '1' }, amount: { isNegative: () => false }, isApproved: false },
          { accountId: { toString: () => '2' }, amount: { isNegative: () => true }, isApproved: false },
        ],
      } as unknown as TransferTransaction;

      const model = new TransferTransactionModel(tx);
      const accounts = model.getReceiverAccounts();

      expect(accounts).toEqual(new Set(['1']));
    });

    it('should return empty set if no transfers meet criteria', () => {
      const tx = {
        hbarTransfersList: [
          { accountId: { toString: () => '2' }, amount: { isNegative: () => true }, isApproved: false },
        ],
      } as unknown as TransferTransaction;

      const model = new TransferTransactionModel(tx);
      const accounts = model.getReceiverAccounts();

      expect(accounts.size).toBe(0);
    });
  });
});