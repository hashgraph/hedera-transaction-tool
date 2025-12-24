import { FreezeTransaction } from '@hashgraph/sdk';
import { TransactionBaseModel } from './transaction-base.model';
import TransactionFactory from './transaction-factory';

export default class FreezeTransactionModel
  extends TransactionBaseModel<FreezeTransaction> {
  static readonly TRANSACTION_TYPE = 'FreezeTransaction';
}

TransactionFactory.register(
  FreezeTransactionModel.TRANSACTION_TYPE,
  FreezeTransactionModel
);
