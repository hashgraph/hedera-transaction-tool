import { NodeUpdateTransaction, Key, Long } from '@hashgraph/sdk';
import { NodeUpdateTransactionModel } from './node-update-transaction.model';

describe('NodeUpdateTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(NodeUpdateTransactionModel.TRANSACTION_TYPE).toBe('NodeUpdateTransaction');
  });

  describe('getNewKeys', () => {
    it('should return the adminKey in an array if present', () => {
      const adminKey = {} as Key;
      const tx = { adminKey } as unknown as NodeUpdateTransaction;

      const model = new NodeUpdateTransactionModel(tx);
      const keys = model.getNewKeys();

      expect(keys).toEqual([adminKey]);
    });

    it('should return empty array if adminKey is null', () => {
      const tx = { adminKey: null } as unknown as NodeUpdateTransaction;

      const model = new NodeUpdateTransactionModel(tx);
      const keys = model.getNewKeys();

      expect(keys).toEqual([]);
    });

    it('should return empty array if adminKey is undefined', () => {
      const tx = { adminKey: undefined } as unknown as NodeUpdateTransaction;

      const model = new NodeUpdateTransactionModel(tx);
      const keys = model.getNewKeys();

      expect(keys).toEqual([]);
    });
  });

  describe('getNodeId', () => {
    it('should return nodeId number if nodeId is defined', () => {
      const nodeId = { toNumber: () => 123 } as unknown as Long;
      const tx = { nodeId } as unknown as NodeUpdateTransaction;

      const model = new NodeUpdateTransactionModel(tx);
      const result = model.getNodeId();

      expect(result).toBe(123);
    });

    it('should return null if nodeId is undefined', () => {
      const tx = { nodeId: undefined } as unknown as NodeUpdateTransaction;

      const model = new NodeUpdateTransactionModel(tx);
      const result = model.getNodeId();

      expect(result).toBeNull();
    });
  });
});