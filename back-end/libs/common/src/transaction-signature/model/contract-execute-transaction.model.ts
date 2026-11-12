import { ContractExecuteTransaction } from '@hiero-ledger/sdk';
import { TransactionBaseModel } from './transaction-base.model';

// No overrides needed: Hedera only requires the fee payer's signature for a contract call -
// on-chain role checks are enforced by the EVM against msg.sender (the fee payer) at execution
// time, not by any additional Hedera-level key requirement.
export class ContractExecuteTransactionModel extends TransactionBaseModel<ContractExecuteTransaction> {
  static readonly TRANSACTION_TYPE = 'ContractExecuteTransaction';
}
