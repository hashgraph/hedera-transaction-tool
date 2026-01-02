import { NodeDeleteTransaction, Long } from '@hashgraph/sdk';
import { NodeDeleteTransactionModel } from './node-delete-transaction.model';
import { COUNCIL_ACCOUNTS } from '@app/common';

describe('NodeDeleteTransactionModel', () => {
  it('should have TRANSACTION_TYPE defined', () => {
    expect(NodeDeleteTransactionModel.TRANSACTION_TYPE).toBe('NodeDeleteTransaction');
  });

  it('should return nodeId number if payer is not a council account', () => {
    const tx = {
      transactionId: { accountId: { toString: () => '1000' } } as unknown as any,
      nodeId: { toNumber: () => 42 } as unknown as Long,
    } as unknown as NodeDeleteTransaction;

    const model = new NodeDeleteTransactionModel(tx);
    const nodeId = model.getNodeId();

    expect(nodeId).toBe(42);
  });

  it('should return null if payer is a council account', () => {
    const councilAccountId = Object.keys(COUNCIL_ACCOUNTS)[0];
    const tx = {
      transactionId: { accountId: { toString: () => councilAccountId } } as unknown as any,
      nodeId: { toNumber: () => 42 } as unknown as Long,
    } as unknown as NodeDeleteTransaction;

    const model = new NodeDeleteTransactionModel(tx);
    const nodeId = model.getNodeId();

    expect(nodeId).toBeNull();
  });

  it('should return null if nodeId is undefined', () => {
    const tx = {
      transactionId: { accountId: { toString: () => '9999' } } as unknown as any,
      nodeId: undefined,
    } as unknown as NodeDeleteTransaction;

    const model = new NodeDeleteTransactionModel(tx);
    const nodeId = model.getNodeId();

    expect(nodeId).toBeNull();
  });

  it('should return null if transactionId is undefined', () => {
    const tx = {
      transactionId: undefined,
      nodeId: { toNumber: () => 42 } as unknown as Long,
    } as unknown as NodeDeleteTransaction;

    const model = new NodeDeleteTransactionModel(tx);
    const nodeId = model.getNodeId();

    expect(nodeId).toBeNull();
  });
});