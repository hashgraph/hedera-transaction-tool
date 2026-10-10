import { ipcMain } from 'electron';
import {
  exportTransactionFile,
  selectTransactionFile,
} from '@main/utils/transactionFile';

export default () => {
  ipcMain.handle('transactionFile:selectTransactionFile', (_e, onlyV2: boolean) =>
    selectTransactionFile(onlyV2),
  );
  ipcMain.handle(
    'transactionFile:exportTransactionFile',
    (_e, transactionFile, defaultName: string) => exportTransactionFile(transactionFile, defaultName),
  );
};
