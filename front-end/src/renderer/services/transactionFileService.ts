import { commonIPCHandler } from '@renderer/utils';
import type { SelectedTransactionFile, TransactionFile } from '@shared/interfaces';

export async function selectTransactionFile(onlyV2 = false): Promise<SelectedTransactionFile> {
  return commonIPCHandler(
    async () => await window.electronAPI.local.transactionFile.selectTransactionFile(onlyV2),
    'Failed to select transaction file',
  );
}

export async function exportTransactionFile(
  transactionFile: TransactionFile,
  defaultName: string,
): Promise<boolean> {
  return commonIPCHandler(
    async () =>
      await window.electronAPI.local.transactionFile.exportTransactionFile(
        transactionFile,
        defaultName,
      ),
    'Failed to export transaction file',
  );
}
