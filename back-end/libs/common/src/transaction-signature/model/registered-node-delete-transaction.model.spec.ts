import { RegisteredNodeDeleteTransaction } from '@hiero-ledger/sdk';
import { RegisteredNodeDeleteTransactionModel } from './registered-node-delete-transaction.model';

describe('RegisteredNodeDeleteTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(RegisteredNodeDeleteTransactionModel.TRANSACTION_TYPE).toBe(
      'RegisteredNodeDeleteTransaction',
    );
  });

  it('should return registered node id and empty key list', () => {
    const tx = new RegisteredNodeDeleteTransaction().setRegisteredNodeId(42);

    const model = new RegisteredNodeDeleteTransactionModel(tx);
    expect(model.getRegisteredNodeId()).toBe(42);
    expect(model.getNewKeys()).toHaveLength(0);
  });
});
