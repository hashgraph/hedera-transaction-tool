import { commonIPCHandler } from '@renderer/utils';
import type { TransactionFileImportResult, TransactionFile } from '@shared/interfaces';

export async function importTransactionFile(onlyV2 = false): Promise<TransactionFileImportResult> {
  return commonIPCHandler(
    async () => await window.electronAPI.local.transactionFile.importTransactionFile(onlyV2),
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
