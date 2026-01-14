import { SystemDeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class SystemDeleteTransactionModel
  extends TransactionBaseModel<SystemDeleteTransaction> {
  static readonly TRANSACTION_TYPE = 'SystemDeleteTransaction';
}
