import { SystemUndeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class SystemUndeleteTransactionModel
  extends TransactionBaseModel<SystemUndeleteTransaction> {

  static readonly TRANSACTION_TYPE = 'SystemUndeleteTransaction';
}

TransactionFactory.register(
  SystemUndeleteTransactionModel.TRANSACTION_TYPE,
  SystemUndeleteTransactionModel
);
