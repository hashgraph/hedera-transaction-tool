import { TransferTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction-base.model';

export class TransferTransactionModel
  extends TransactionBaseModel<TransferTransaction> {

  static readonly TRANSACTION_TYPE = 'TransferTransaction';

  getSigningAccounts(): Set<string> {
    const accounts = new Set<string>();

    // add all accounts that are senders
    for (const transfer of this.transaction.hbarTransfersList) {
      if (transfer.amount.isNegative() && !transfer.isApproved) {
        accounts.add(transfer.accountId.toString());
      }
    }
    return accounts;
  }

  getReceiverAccounts(): Set<string> {
    const accounts = new Set<string>();

    for (const transfer of this.transaction.hbarTransfersList) {
      if (!transfer.amount.isNegative()) {
        accounts.add(transfer.accountId.toString());
      }
    }
    return accounts;
  }
}
