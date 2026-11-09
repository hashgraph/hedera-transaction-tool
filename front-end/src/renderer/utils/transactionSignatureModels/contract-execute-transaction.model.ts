import { ContractExecuteTransaction } from '@hiero-ledger/sdk';
import { TransactionBaseModel } from './transaction.model';

// No overrides needed: Hedera only requires the fee payer's signature for a contract call -
// on-chain role checks (onlyRole, etc.) are enforced by the EVM against msg.sender (the fee
// payer) at execution time, not by any additional Hedera-level key requirement. See
// docs/contract-execute-safe-timelock.md for how this differs once Safe/Timelock wrapping exists.
export default class ContractExecuteTransactionModel extends TransactionBaseModel<ContractExecuteTransaction> {}
