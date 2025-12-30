import { ipcRenderer } from 'electron';
import { TransactionFile } from '@shared/interfaces';

export default {
  transactionFile: {
    readTransactionFile: async (filePath: string): Promise<TransactionFile> =>
      ipcRenderer.invoke('transactionFile:readTransactionFile', filePath),
    writeTransactionFile: async (
      transactionFile: TransactionFile,
      filePath: string,
    ): Promise<void> =>
      ipcRenderer.invoke('transactionFile:writeTransactionFile', transactionFile, filePath),
  },
};
