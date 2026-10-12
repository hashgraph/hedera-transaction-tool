import { mockDeep } from 'vitest-mock-extended';
import { getIPCHandler, invokeIPCHandler } from '../../../_utils_';
import registerTransactionFileHandlers from '@main/modules/ipcHandlers/localUser/transactionFile';
import { exportTransactionFile, importTransactionFile } from '@main/utils/transactionFile';
import type { TransactionFile } from '@shared/interfaces';

vi.mock('@main/utils/transactionFile', () => mockDeep());

describe('IPC handlers transactionFile', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    registerTransactionFileHandlers();
  });

  test('registers import and export handlers', () => {
    expect(getIPCHandler('transactionFile:importTransactionFile')).toBeTruthy();
    expect(getIPCHandler('transactionFile:exportTransactionFile')).toBeTruthy();
  });

  test('forwards the TX2-only import option and returns the import result', async () => {
    const importResult = {
      kind: 'tx2' as const,
      suggestedName: 'transaction.tx2',
      transactionFile: { network: 'testnet', items: [] },
    };
    vi.mocked(importTransactionFile).mockResolvedValue(importResult);

    await expect(invokeIPCHandler('transactionFile:importTransactionFile', true)).resolves.toEqual(importResult);
    expect(importTransactionFile).toHaveBeenCalledWith(true);
  });

  test('forwards the transaction file and suggested name to export', async () => {
    const transactionFile: TransactionFile = { network: 'testnet', items: [] };
    vi.mocked(exportTransactionFile).mockResolvedValue(true);

    await expect(
      invokeIPCHandler('transactionFile:exportTransactionFile', transactionFile, 'transaction.tx2'),
    ).resolves.toBe(true);
    expect(exportTransactionFile).toHaveBeenCalledWith(transactionFile, 'transaction.tx2');
  });
});
