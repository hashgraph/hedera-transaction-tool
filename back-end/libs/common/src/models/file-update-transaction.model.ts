import { FileUpdateTransaction } from '@hashgraph/sdk';
import { flattenKeyList } from '@app/common';

import { TransactionBaseModel } from './transaction.model';

export default class FileUpdateTransactionModel extends TransactionBaseModel<FileUpdateTransaction> {
  getNewKeys(): Set<string> {
    const set = new Set<string>();

    this.transaction.keys.forEach(key => {
      flattenKeyList(key).map(key => set.add(key.toStringRaw()));
    });

    return set;
  }
}
