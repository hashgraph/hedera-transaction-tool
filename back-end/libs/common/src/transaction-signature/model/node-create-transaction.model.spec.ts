import { NodeCreateTransaction, Key } from '@hashgraph/sdk';
import { NodeCreateTransactionModel } from './node-create-transaction.model';

describe('NodeCreateTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(NodeCreateTransactionModel.TRANSACTION_TYPE).toBe('NodeCreateTransaction');
  });

  it('should return the adminKey in an array if present', () => {
    const adminKey = {} as Key;

    const tx = {
      adminKey,
    } as unknown as NodeCreateTransaction;

    const model = new NodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([adminKey]);
  });

  it('should return empty array if adminKey is null', () => {
    const tx = {
      adminKey: null,
    } as unknown as NodeCreateTransaction;

    const model = new NodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });

  it('should return empty array if adminKey is undefined', () => {
    const tx = {
      adminKey: undefined,
    } as unknown as NodeCreateTransaction;

    const model = new NodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });
});