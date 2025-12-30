import { createIPCChannel, renameFunc } from '@main/utils/electronInfra';
import { readTransactionFile, writeTransactionFile } from '@main/utils/transactionFile';

export default () => {
  /* Transactions */
  createIPCChannel(
    'transactionFile', [
      renameFunc(readTransactionFile, 'readTransactionFile'),
      renameFunc(writeTransactionFile, 'writeTransactionFile'),
    ]
  );
};
