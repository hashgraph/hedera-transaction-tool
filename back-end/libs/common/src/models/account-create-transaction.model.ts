import { AccountCreateTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class AccountCreateTransactionModel
  extends TransactionBaseModel<AccountCreateTransaction> {
  static readonly TRANSACTION_TYPE = 'AccountCreateTransaction';
}

TransactionFactory.register(
  AccountCreateTransactionModel.TRANSACTION_TYPE,
  AccountCreateTransactionModel
);
