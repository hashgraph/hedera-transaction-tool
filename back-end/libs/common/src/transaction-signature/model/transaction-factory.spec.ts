import TransactionFactory from './transaction-factory';
import { TokenBurnTransaction, TransferTransaction } from '@hiero-ledger/sdk';
import * as Models from '.';
import { TransferTransactionModel } from '.';

// Mock getTransactionType so we can control it
jest.mock('@app/common', () => ({
  getTransactionType: jest.fn(),
}));

// const mockedGetTransactionType = getTransactionType as jest.Mock;

describe('TransactionFactory', () => {
  it('should have all models with a TRANSACTION_TYPE', () => {
    Object.values(Models).forEach((Model: any) => {
      expect(Model.TRANSACTION_TYPE).toBeDefined();
      expect(typeof Model.TRANSACTION_TYPE).toBe('string');
    });
  });

  it('should throw if transaction type is not registered', () => {
    const unregisteredTx = new TokenBurnTransaction();

    expect(() => TransactionFactory.fromTransaction(unregisteredTx)).toThrow(
      'No transaction model registered for type: TokenBurnTransaction',
    );
  });

  it('fromBytes should delegate to fromTransaction', () => {
    const sampleTx = new TransferTransaction();
    const sampleBytes = sampleTx.toBytes();

    const instance = TransactionFactory.fromBytes(Buffer.from(sampleBytes));
    expect(instance).toBeInstanceOf(TransferTransactionModel);
  });
});
