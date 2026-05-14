import { RegisteredNodeCreateTransaction, Key } from '@hiero-ledger/sdk';
import { RegisteredNodeCreateTransactionModel } from './registered-node-create-transaction.model';

describe('RegisteredNodeCreateTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(RegisteredNodeCreateTransactionModel.TRANSACTION_TYPE).toBe(
      'RegisteredNodeCreateTransaction',
    );
  });

  it('should return the adminKey in an array if present', () => {
    const adminKey = {} as Key;

    const tx = {
      adminKey,
    } as unknown as RegisteredNodeCreateTransaction;

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([adminKey]);
  });

  it('should return empty array if adminKey is null', () => {
    const tx = {
      adminKey: null,
    } as unknown as RegisteredNodeCreateTransaction;

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });

  it('should return empty array if adminKey is undefined', () => {
    const tx = {
      adminKey: undefined,
    } as unknown as RegisteredNodeCreateTransaction;

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });
});
