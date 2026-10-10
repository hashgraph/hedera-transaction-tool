import { ipcRenderer } from 'electron';
import type { SelectedTransactionFile, TransactionFile } from '@shared/interfaces';

export default {
  transactionFile: {
    selectTransactionFile: async (onlyV2: boolean): Promise<SelectedTransactionFile> =>
      ipcRenderer.invoke('transactionFile:selectTransactionFile', onlyV2),
    exportTransactionFile: async (transactionFile: TransactionFile, defaultName: string): Promise<boolean> =>
      ipcRenderer.invoke('transactionFile:exportTransactionFile', transactionFile, defaultName),
  },
};
