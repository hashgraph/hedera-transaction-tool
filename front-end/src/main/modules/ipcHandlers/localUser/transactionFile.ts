import { ipcMain } from 'electron';
import {
  exportTransactionFile,
  importTransactionFile,
} from '@main/utils/transactionFile';

export default () => {
  ipcMain.handle('transactionFile:importTransactionFile', (_e, onlyV2: boolean) =>
    importTransactionFile(onlyV2),
  );
  ipcMain.handle(
    'transactionFile:exportTransactionFile',
    (_e, transactionFile, defaultName: string) => exportTransactionFile(transactionFile, defaultName),
  );
};
