import { AccountCreateTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class AccountCreateTransactionModel
  extends TransactionBaseModel<AccountCreateTransaction> {
  static readonly TRANSACTION_TYPE = 'AccountCreateTransaction';
}
