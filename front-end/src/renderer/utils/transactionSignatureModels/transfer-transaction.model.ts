import { TransferTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';

export default class TransferTransactionModel extends TransactionBaseModel<TransferTransaction> {
  getSigningAccounts(): Set<string> {
    // Get the Fee Payer
    const accounts = super.getSigningAccounts();

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
