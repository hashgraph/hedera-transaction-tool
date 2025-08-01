import { FileUpdateTransaction } from '@hashgraph/sdk';

import { TransactionBaseModel } from './transaction.model';
import { isHederaSpecialFileId } from '@main/utils/hederaSpecialFiles';

export default class FileUpdateTransactionModel extends TransactionBaseModel<FileUpdateTransaction> {
  getNewKeys() {
    // If system file, return empty array
    // any key would be purely ornamental
    // https://github.com/hiero-ledger/hiero-consensus-node/blob/main/hedera-node/docs/privileged-transactions.md#waived-signing-requirements
    if (isHederaSpecialFileId(this.transaction.fileId.toString())) {
      return [];
    }
    return this.transaction.keys || [];
  }
}
