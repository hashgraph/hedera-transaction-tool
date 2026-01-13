import { FileCreateTransaction, Key } from '@hashgraph/sdk';
import { FileCreateTransactionModel } from './file-create-transaction.model';

describe('FileCreateTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(FileCreateTransactionModel.TRANSACTION_TYPE).toBe('FileCreateTransaction');
  });

  it('should return keys if transaction has keys', () => {
    const key1 = {} as Key;
    const key2 = {} as Key;

    const tx = {
      keys: [key1, key2],
    } as unknown as FileCreateTransaction;

    const model = new FileCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([key1, key2]);
  });

  it('should return empty array if transaction.keys is undefined', () => {
    const tx = {
      keys: undefined,
    } as unknown as FileCreateTransaction;

    const model = new FileCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });
});