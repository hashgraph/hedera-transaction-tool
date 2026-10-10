import { ipcRenderer } from 'electron';
import type { TransactionFileImportResult, TransactionFile } from '@shared/interfaces';

export default {
  transactionFile: {
    importTransactionFile: async (onlyV2: boolean): Promise<TransactionFileImportResult> =>
      ipcRenderer.invoke('transactionFile:importTransactionFile', onlyV2),
    exportTransactionFile: async (transactionFile: TransactionFile, defaultName: string): Promise<boolean> =>
      ipcRenderer.invoke('transactionFile:exportTransactionFile', transactionFile, defaultName),
  },
};
