import {
  AccountId,
  ContractExecuteTransaction,
  ContractId,
  TransactionId,
} from '@hiero-ledger/sdk';
import { ContractExecuteTransactionModel } from './contract-execute-transaction.model';

describe('ContractExecuteTransactionModel', () => {
  const payer = '0.0.1234';
  const contractId = '0.0.5678';

  const createModel = () => {
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractId))
      .setGas(100_000)
      .setTransactionId(TransactionId.generate(payer));
    return new ContractExecuteTransactionModel(tx);
  };

  it('identifies itself as a ContractExecuteTransaction', () => {
    expect(ContractExecuteTransactionModel.TRANSACTION_TYPE).toBe('ContractExecuteTransaction');
  });

  it('requires the fee payer signature', () => {
    expect(createModel().getFeePayerAccountId()?.toString()).toBe(
      AccountId.fromString(payer).toString(),
    );
  });

  it('requires no signatures beyond the fee payer (role checks happen on-chain)', () => {
    const model = createModel();

    expect(model.getSigningAccounts().size).toBe(0);
    expect(model.getReceiverAccounts().size).toBe(0);
    expect(model.getNewKeys()).toEqual([]);
    expect(model.getNodeId()).toBeNull();
    expect(model.getRegisteredNodeId()).toBeNull();
  });
});
