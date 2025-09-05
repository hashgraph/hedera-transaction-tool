import { FileUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';
import { isHederaSpecialFileId } from '@app/common';

export default class FileUpdateTransactionModel extends TransactionBaseModel<FileUpdateTransaction> {
  // If a system file, the fee payer must 2,50,55,56,57, or 58 depending on the file.
  // This validation should be added in the future.

  // AccountInfo lookup should work with fileId as well. Currently, mirror node does not support any file info lookups.
  // In addition to mirror node, the AccountInfo lookup should check local storage, which is where this will come
  // into play.
  // getSigningAccounts(): Set<string> {
  //   const signingAccounts = super.getSigningAccounts();
  //   signingAccounts.add(this.transaction.fileId.toString());
  //   return signingAccounts;
  // }

  getNewKeys() {
    // If system file, return empty array
    // any key would be purely ornamental
    // https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hedera-node/docs/privileged-transactions.md#waived-signing-requirements
    if (isHederaSpecialFileId(this.transaction.fileId?.toString())) {
      return [];
    }
    return this.transaction.keys || [];
  }
}
