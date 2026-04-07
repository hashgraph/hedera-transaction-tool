import { SystemDeleteTransaction } from '@hiero-ledger/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class SystemDeleteTransactionModel
  extends TransactionBaseModel<SystemDeleteTransaction> {
  static readonly TRANSACTION_TYPE = 'SystemDeleteTransaction';
}
