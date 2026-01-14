import { SystemUndeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class SystemUndeleteTransactionModel
  extends TransactionBaseModel<SystemUndeleteTransaction> {
  static readonly TRANSACTION_TYPE = 'SystemUndeleteTransaction';
}
