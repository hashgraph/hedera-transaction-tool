import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fsp from 'fs/promises';
import { exportTransactionFile, importTransactionFile } from '@main/utils/transactionFile';
import { showTransactionOpenDialog, showTransactionSaveDialog } from '@main/modules/ipcHandlers/utils';
import type { TransactionFile } from '@shared/interfaces';

vi.mock('fs/promises');
vi.mock('@main/modules/ipcHandlers/utils', () => ({
  showTransactionOpenDialog: vi.fn(),
  showTransactionSaveDialog: vi.fn(),
}));
vi.mock('@main/services/localUser/importV1', () => ({ filterForImportV1: vi.fn() }));
import { filterForImportV1 } from '@main/services/localUser/importV1';

const transactionFile: TransactionFile = { network: 'testnet', items: [] };

describe('transactionFile utils', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads only a tx2 path returned by the main-process open dialog', async () => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/chosen/file.tx2'] });
    vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify(transactionFile));

    const selected = await importTransactionFile(true);
    expect(fsp.readFile).toHaveBeenCalledWith('/chosen/file.tx2', { encoding: 'utf8' });
    expect(selected).toMatchObject({ kind: 'tx2', suggestedName: 'file.tx2', transactionFile });
  });

  it('returns cancellation without reading a file', async () => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: true, filePaths: [] });
    await expect(importTransactionFile()).resolves.toBeNull();
    expect(fsp.readFile).not.toHaveBeenCalled();
  });

  it('parses a selected ZIP in the main process and returns no filesystem path', async () => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/home/user/import.zip'] });
    vi.mocked(filterForImportV1).mockResolvedValue({
      candidates: [{
        filePath: '/home/user/import.zip', transactionId: '0.0.123@1.2', transactionBytes: 'abcd', nodeSignatures: {},
      }],
      ignoredPaths: ['/home/user/import.zip'],
    });

    await expect(importTransactionFile()).resolves.toEqual({
      kind: 'zip',
      importResult: {
        candidates: [{
          filePath: 'import.zip', transactionId: '0.0.123@1.2', transactionBytes: 'abcd', nodeSignatures: {},
        }],
        ignoredPaths: ['import.zip'],
      },
    });
    expect(filterForImportV1).toHaveBeenCalledWith(['/home/user/import.zip']);
  });

  it('rejects a file outside the supported transaction extensions', async () => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/home/user/.bashrc'] });
    await expect(importTransactionFile(true)).rejects.toThrow('Unsupported transaction file extension');
    expect(fsp.readFile).not.toHaveBeenCalled();
  });

  it('exports only to the path returned by the main-process save dialog', async () => {
    vi.mocked(showTransactionSaveDialog).mockResolvedValue({ canceled: false, filePath: '/chosen/export.tx2' });
    await expect(exportTransactionFile(transactionFile, 'export.tx2')).resolves.toBe(true);
    expect(fsp.writeFile).toHaveBeenCalledWith('/chosen/export.tx2', JSON.stringify(transactionFile), { encoding: 'utf8' });
  });

  it('does not write when export is cancelled', async () => {
    vi.mocked(showTransactionSaveDialog).mockResolvedValue({ canceled: true, filePath: '' });
    await expect(exportTransactionFile(transactionFile, 'export.tx2')).resolves.toBe(false);
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });
});
