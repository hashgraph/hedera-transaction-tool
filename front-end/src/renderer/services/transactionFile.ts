import { commonIPCHandler } from '@renderer/utils';
import type { TransactionFile } from '@shared/interfaces';

export async function readTransactionFile(filePath: string): Promise<TransactionFile> {
  return commonIPCHandler(
    async () => await window.electronAPI.local.transactionFile.readTransactionFile(filePath),
    'Failed to read transaction file',
  );
}

export async function writeTransactionFile(
  transactionFile: TransactionFile,
  filePath: string,
): Promise<void> {
  return commonIPCHandler(
    async () =>
      await window.electronAPI.local.transactionFile.writeTransactionFile(
        transactionFile,
        filePath,
      ),
    'Failed to read transaction file',
  );
}
