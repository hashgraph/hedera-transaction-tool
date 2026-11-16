import {
  AccountId,
  ContractCreateTransaction,
  KeyList,
  PrivateKey,
  TransactionId,
} from '@hiero-ledger/sdk';
import { ContractCreateTransactionModel } from './contract-create-transaction.model';

describe('ContractCreateTransactionModel', () => {
  const payer = '0.0.1234';

  const createModel = (tx = new ContractCreateTransaction()) => {
    tx.setGas(100_000).setTransactionId(TransactionId.generate(payer));
    return new ContractCreateTransactionModel(tx);
  };

  it('identifies itself as a ContractCreateTransaction', () => {
    expect(ContractCreateTransactionModel.TRANSACTION_TYPE).toBe('ContractCreateTransaction');
  });

  it('requires the fee payer signature', () => {
    expect(createModel().getFeePayerAccountId()?.toString()).toBe(
      AccountId.fromString(payer).toString(),
    );
  });

  it('requires no signing/receiver accounts beyond the fee payer', () => {
    const model = createModel();

    expect(model.getSigningAccounts().size).toBe(0);
    expect(model.getReceiverAccounts().size).toBe(0);
    expect(model.getNodeId()).toBeNull();
    expect(model.getRegisteredNodeId()).toBeNull();
  });

  it('returns an empty array when no admin key is set (contract will be immutable)', () => {
    expect(createModel().getNewKeys()).toEqual([]);
  });

  // HAPI: "If this field is set, that key MUST sign this transaction" - protocol-mandated,
  // unlike ContractExecuteTransactionModel's lack of a new key.
  it('requires the admin key to sign, when set', () => {
    const adminKey = PrivateKey.generateED25519().publicKey;
    const tx = new ContractCreateTransaction().setAdminKey(adminKey);
    expect(createModel(tx).getNewKeys()).toEqual([adminKey]);
  });

  it('requires a complex (threshold) admin key to sign, when set', () => {
    const keys = [1, 2, 3].map(() => PrivateKey.generateED25519().publicKey);
    const adminKey = new KeyList(keys, 2);
    const tx = new ContractCreateTransaction().setAdminKey(adminKey);
    expect(createModel(tx).getNewKeys()).toEqual([adminKey]);
  });
});
