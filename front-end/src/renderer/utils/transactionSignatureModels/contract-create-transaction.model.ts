import { ContractCreateTransaction, Key } from '@hiero-ledger/sdk';
import { TransactionBaseModel } from './transaction.model';

// HAPI's ContractCreateTransactionBody.adminKey doc: "If this field is set, that key MUST sign
// this transaction." - protocol-mandated, unlike ContractExecuteTransactionModel (no new key
// involved) and unlike AccountCreateTransactionModel (which has no override despite setting a
// new key). Mirrors FileCreateTransactionModel's precedent for a new key that gates future
// update/delete of the created entity. Matches the back-end's ContractCreateTransactionModel.
export default class ContractCreateTransactionModel extends TransactionBaseModel<ContractCreateTransaction> {
  override getNewKeys(): Key[] {
    return this.transaction.adminKey ? [this.transaction.adminKey] : [];
  }
}
