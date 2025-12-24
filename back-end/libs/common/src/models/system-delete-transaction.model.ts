import { SystemDeleteTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import { TransactionFactory } from './transaction-factory';

export default class SystemDeleteTransactionModel
  extends TransactionBaseModel<SystemDeleteTransaction> {
  static readonly TRANSACTION_TYPE = 'SystemDeleteTransaction';
}

TransactionFactory.register(
  SystemDeleteTransactionModel.TRANSACTION_TYPE,
  SystemDeleteTransactionModel
);
