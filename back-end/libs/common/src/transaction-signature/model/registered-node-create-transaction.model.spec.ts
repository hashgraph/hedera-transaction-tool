import { KeyList, PrivateKey, RegisteredNodeCreateTransaction } from '@hiero-ledger/sdk';
import { RegisteredNodeCreateTransactionModel } from './registered-node-create-transaction.model';

describe('RegisteredNodeCreateTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(RegisteredNodeCreateTransactionModel.TRANSACTION_TYPE).toBe(
      'RegisteredNodeCreateTransaction',
    );
  });

  it('should return the adminKey in an array when a single PublicKey is set', () => {
    const adminKey = PrivateKey.generateED25519().publicKey;
    const tx = new RegisteredNodeCreateTransaction().setAdminKey(adminKey);

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(adminKey);
  });

  it('should return the adminKey when it is a KeyList', () => {
    const member1 = PrivateKey.generateED25519().publicKey;
    const member2 = PrivateKey.generateED25519().publicKey;
    const adminKey = new KeyList([member1, member2]);

    const tx = new RegisteredNodeCreateTransaction().setAdminKey(adminKey);

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(adminKey);
  });

  it('should return the adminKey when it is a ThresholdKey (2-of-3 KeyList)', () => {
    const member1 = PrivateKey.generateED25519().publicKey;
    const member2 = PrivateKey.generateED25519().publicKey;
    const member3 = PrivateKey.generateED25519().publicKey;
    const adminKey = new KeyList([member1, member2, member3], 2);

    const tx = new RegisteredNodeCreateTransaction().setAdminKey(adminKey);

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe(adminKey);
  });

  it('should return empty array if adminKey is not set on the transaction', () => {
    const tx = new RegisteredNodeCreateTransaction();

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });

  it('should return empty array if adminKey is explicitly null', () => {
    const tx = { adminKey: null } as unknown as RegisteredNodeCreateTransaction;

    const model = new RegisteredNodeCreateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toEqual([]);
  });
});
