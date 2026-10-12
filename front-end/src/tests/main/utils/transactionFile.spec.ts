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

  it('propagates file-read errors for the dialog-selected path', async () => {
    const readError = new Error('EACCES: permission denied');
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/chosen/file.tx2'] });
    vi.mocked(fsp.readFile).mockRejectedValue(readError);

    await expect(importTransactionFile(true)).rejects.toThrow(readError);
    expect(fsp.readFile).toHaveBeenCalledWith('/chosen/file.tx2', { encoding: 'utf8' });
  });

  it('rejects invalid JSON in the dialog-selected file', async () => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/chosen/file.tx2'] });
    vi.mocked(fsp.readFile).mockResolvedValue('{not valid json');

    await expect(importTransactionFile(true)).rejects.toThrow(SyntaxError);
  });

  it('accepts a custom network identifier without an explicit insecure scheme', async () => {
    const customNetworkFile: TransactionFile = { network: 'custom.mirror.example/v1', items: [] };
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/chosen/file.tx2'] });
    vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify(customNetworkFile));

    await expect(importTransactionFile(true)).resolves.toMatchObject({
      kind: 'tx2',
      transactionFile: customNetworkFile,
    });
  });

  it('rejects transaction files with an unsupported top-level shape', async () => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/chosen/file.tx2'] });
    vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify({ network: 'testnet' }));

    await expect(importTransactionFile(true)).rejects.toThrow(
      'Invalid transaction file: unsupported format or network',
    );
  });

  it('rejects transaction files with a non-HTTPS network URL', async () => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/chosen/file.tx2'] });
    vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify({ network: 'http://mirror.example', items: [] }));

    await expect(importTransactionFile(true)).rejects.toThrow(
      'Invalid transaction file network: HTTPS is required',
    );
  });

  it.each([
    null,
    { transactionBytes: 1, name: 'name', description: 'description', creatorEmail: 'email' },
    { transactionBytes: 'bytes', name: 1, description: 'description', creatorEmail: 'email' },
    { transactionBytes: 'bytes', name: 'name', description: 1, creatorEmail: 'email' },
    { transactionBytes: 'bytes', name: 'name', description: 'description', creatorEmail: 1 },
  ])('rejects malformed transaction items (%#)', async invalidItem => {
    vi.mocked(showTransactionOpenDialog).mockResolvedValue({ canceled: false, filePaths: ['/chosen/file.tx2'] });
    vi.mocked(fsp.readFile).mockResolvedValue(
      JSON.stringify({ network: 'testnet', items: [invalidItem] }),
    );

    await expect(importTransactionFile(true)).rejects.toThrow(
      'Invalid transaction file: invalid transaction item',
    );
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
