import { FreezeTransaction } from '@hiero-ledger/sdk';
import { TransactionBaseModel } from './transaction-base.model';

export class FreezeTransactionModel
  extends TransactionBaseModel<FreezeTransaction> {
  static readonly TRANSACTION_TYPE = 'FreezeTransaction';
}
