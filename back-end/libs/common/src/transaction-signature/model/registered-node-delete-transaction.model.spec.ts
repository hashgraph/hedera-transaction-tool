import { RegisteredNodeDeleteTransaction } from '@hiero-ledger/sdk';
import { RegisteredNodeDeleteTransactionModel } from './registered-node-delete-transaction.model';

describe('RegisteredNodeDeleteTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(RegisteredNodeDeleteTransactionModel.TRANSACTION_TYPE).toBe(
      'RegisteredNodeDeleteTransaction',
    );
  });

  it('should return an empty key list', () => {
    const tx = new RegisteredNodeDeleteTransaction();

    const model = new RegisteredNodeDeleteTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toHaveLength(0);
  });
});
