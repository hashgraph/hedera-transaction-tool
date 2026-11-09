// @vitest-environment node
import { describe, expect, test, vi } from 'vitest';

import { ContractExecuteTransaction, ContractId } from '@hiero-ledger/sdk';

vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), error: vi.fn(), info: vi.fn(), log: vi.fn(), warn: vi.fn() }),
}));

// Entering via the utils barrel first avoids a pre-existing import cycle (models <-> utils).
import '@renderer/utils';
import { TransactionBaseModel } from '@renderer/utils/transactionSignatureModels/transaction.model';

import ContractExecuteTransactionModel from '@renderer/utils/transactionSignatureModels/contract-execute-transaction.model';
import TransactionFactory from '@renderer/utils/transactionSignatureModels/transaction-factory';

describe('ContractExecuteTransactionModel', () => {
  test('extends the base model and wraps the transaction', () => {
    const tx = new ContractExecuteTransaction().setContractId(ContractId.fromString('0.0.1234'));
    const model = new ContractExecuteTransactionModel(tx);
    expect(model).toBeInstanceOf(TransactionBaseModel);
    expect((model as unknown as { transaction: unknown }).transaction).toBe(tx);
  });

  test('TransactionFactory.fromTransaction picks this model for ContractExecuteTransaction', () => {
    const tx = new ContractExecuteTransaction();
    const model = TransactionFactory.fromTransaction(tx);
    expect(model).toBeInstanceOf(ContractExecuteTransactionModel);
  });
});
