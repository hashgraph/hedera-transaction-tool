import TransactionFactory from './transaction-factory';
import { Transaction } from '@hashgraph/sdk';
import * as Models from '.';
import { getTransactionType } from '@app/common';

// Mock getTransactionType so we can control it
jest.mock('@app/common', () => ({
  getTransactionType: jest.fn(),
}));

const mockedGetTransactionType = getTransactionType as jest.Mock;

describe('TransactionFactory', () => {
  it('should have all models with a TRANSACTION_TYPE', () => {
    Object.values(Models).forEach((Model: any) => {
      expect(Model.TRANSACTION_TYPE).toBeDefined();
      expect(typeof Model.TRANSACTION_TYPE).toBe('string');
    });
  });

  it('should throw if transaction type is not registered', () => {
    const fakeTx = {} as Transaction;
    mockedGetTransactionType.mockReturnValue('NON_EXISTENT_TYPE');

    expect(() => TransactionFactory.fromTransaction(fakeTx)).toThrow(
      'No transaction model registered for type: NON_EXISTENT_TYPE'
    );
  });

  it('fromBytes should delegate to fromTransaction', () => {
    const fakeTx = {} as Transaction;
    const fakeBytes = Buffer.from([]);

    // Mock Transaction.fromBytes to return our fake transaction
    const fromBytesSpy = jest
      .spyOn(Transaction, 'fromBytes')
      .mockReturnValue(fakeTx);

    // Pick a real model
    const [Model] = Object.values(Models) as any[];
    mockedGetTransactionType.mockReturnValue(Model.TRANSACTION_TYPE);

    const instance = TransactionFactory.fromBytes(fakeBytes);
    expect(instance).toBeInstanceOf(Model);

    fromBytesSpy.mockRestore();
  });
});