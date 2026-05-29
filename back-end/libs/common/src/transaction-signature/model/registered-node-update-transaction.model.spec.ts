import {
  Key,
  Long,
  RegisteredNodeUpdateTransaction,
} from '@hiero-ledger/sdk';
import { RegisteredNodeUpdateTransactionModel } from './registered-node-update-transaction.model';

describe('RegisteredNodeUpdateTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(RegisteredNodeUpdateTransactionModel.TRANSACTION_TYPE).toBe(
      'RegisteredNodeUpdateTransaction',
    );
  });

  describe('getNewKeys', () => {
    it('should return the adminKey in an array if present', () => {
      const adminKey = {} as Key;
      const tx = { adminKey } as unknown as RegisteredNodeUpdateTransaction;

      const model = new RegisteredNodeUpdateTransactionModel(tx);
      const keys = model.getNewKeys();

      expect(keys).toEqual([adminKey]);
    });

    it('should return empty array if adminKey is null', () => {
      const tx = { adminKey: null } as unknown as RegisteredNodeUpdateTransaction;

      const model = new RegisteredNodeUpdateTransactionModel(tx);
      const keys = model.getNewKeys();

      expect(keys).toEqual([]);
    });

    it('should return empty array if adminKey is undefined', () => {
      const tx = { adminKey: undefined } as unknown as RegisteredNodeUpdateTransaction;

      const model = new RegisteredNodeUpdateTransactionModel(tx);
      const keys = model.getNewKeys();

      expect(keys).toEqual([]);
    });
  });

    it('should return an empty key list', () => {
    const tx = new RegisteredNodeUpdateTransaction();

    const model = new RegisteredNodeUpdateTransactionModel(tx);
    const keys = model.getNewKeys();

    expect(keys).toHaveLength(0);
  });

  describe('getNodeId', () => {
    it('should return nodeId number if nodeId is defined', () => {
      const registeredNodeId = { toNumber: () => 123 } as unknown as Long;
      const tx = { registeredNodeId } as unknown as RegisteredNodeUpdateTransaction;

      const model = new RegisteredNodeUpdateTransactionModel(tx);
      const result = model.getRegisteredNodeId();

      expect(result).toBe(123);
    });

    it('should return null if nodeId is undefined', () => {
      const tx = { registeredNodeId: undefined } as unknown as RegisteredNodeUpdateTransaction;

      const model = new RegisteredNodeUpdateTransactionModel(tx);
      const result = model.getRegisteredNodeId();

      expect(result).toBeNull();
    });
  });
});
