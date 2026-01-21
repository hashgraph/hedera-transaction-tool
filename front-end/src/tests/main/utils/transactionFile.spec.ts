import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsp from 'fs/promises';
import { readTransactionFile, writeTransactionFile } from '@main/utils/transactionFile';
import type { TransactionFile } from '@shared/interfaces';

vi.mock('fs/promises');

const fileItems = [
  {
    name: 'Transaction 1',
    description: 'First Create File transaction',
    transactionBytes:
      '0a88012a85010a80010a150a0808f7f2fdcc06100012070800100018ea0718001206080010001803188084af5f220308b401320e4372656174652066696c652074788a0144120b088d8f90cf061080fbb45e1a240a221220e88d731ad218447874d7470b797cac989d23107b4da129441665625cd5269ab022046e756c6c420946696c65206d656d6f1200',
    creatorEmail: 'simon.vienot@icloud.com',
  },
  {
    name: 'Transaction 2',
    description: 'Second Create File transaction',
    transactionBytes:
      '0a88012a85010a80010a150a0808f7cff8cc06100012070800100018ea0718001206080010001803188084af5f220308b401320e4372656174652066696c652074788a0144120b088d8f90cf061080fbb45e1a240a221220e88d731ad218447874d7470b797cac989d23107b4da129441665625cd5269ab022046e756c6c420946696c65206d656d6f1200',
    creatorEmail: 'simon.vienot@icloud.com',
  },
  {
    name: 'Transaction 3',
    description: 'Third Create File transaction',
    transactionBytes:
      '0a88012a85010a80010a150a0808f7acf3cc06100012070800100018ea0718001206080010001803188084af5f220308b401320e4372656174652066696c652074788a0144120b088d8f90cf061080fbb45e1a240a221220e88d731ad218447874d7470b797cac989d23107b4da129441665625cd5269ab022046e756c6c420946696c65206d656d6f1200',
    creatorEmail: 'simon.vienot@icloud.com',
  },
];

const emptyTransactionFile: TransactionFile = {
  network: 'mainnet',
  items: [],
};

const singleTransactionFile: TransactionFile = {
  network: 'local-node',
  items: [fileItems[0]],
};

const multipleTransactionFile: TransactionFile = {
  network: 'local-node',
  items: fileItems,
};

describe('transactionFile utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('readTransactionFile', () => {
    it('should read and parse a transaction file successfully', async () => {
      const mockFilePath = '/path/to/transaction.json';
      const mockTransactionFile = singleTransactionFile;

      vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify(mockTransactionFile));

      const result = await readTransactionFile(mockFilePath);

      expect(fsp.readFile).toHaveBeenCalledWith(mockFilePath, { encoding: 'utf8' });
      expect(result).toEqual(mockTransactionFile);
    });

    it('should handle empty items array', async () => {
      const mockFilePath = '/path/to/empty-transaction.json';
      const mockTransactionFile = emptyTransactionFile;

      vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify(mockTransactionFile));

      const result = await readTransactionFile(mockFilePath);

      expect(result).toEqual(mockTransactionFile);
      expect(result.items).toHaveLength(0);
    });

    it('should handle multiple transaction items', async () => {
      const mockFilePath = '/path/to/multi-transaction.json';

      vi.mocked(fsp.readFile).mockResolvedValue(JSON.stringify(multipleTransactionFile));

      const result = await readTransactionFile(mockFilePath);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].name).toBe(fileItems[0].name);
      expect(result.items[1].name).toBe(fileItems[1].name);
      expect(result.items[2].name).toBe(fileItems[2].name);
    });

    it('should throw error when file cannot be read', async () => {
      const mockFilePath = '/path/to/nonexistent.json';
      const mockError = new Error('ENOENT: no such file or directory');

      vi.mocked(fsp.readFile).mockRejectedValue(mockError);

      await expect(readTransactionFile(mockFilePath)).rejects.toThrow(mockError);
    });

    it('should throw error when JSON is invalid', async () => {
      const mockFilePath = '/path/to/invalid.json';
      const invalidJson = '{invalid json content';

      vi.mocked(fsp.readFile).mockResolvedValue(invalidJson);

      await expect(readTransactionFile(mockFilePath)).rejects.toThrow();
    });
  });

  describe('writeTransactionFile', () => {
    it('should write transaction file successfully', async () => {
      const mockFilePath = '/path/to/output.json';
      const mockTransactionFile = singleTransactionFile;

      vi.mocked(fsp.writeFile).mockResolvedValue(undefined);

      await writeTransactionFile(mockTransactionFile, mockFilePath);

      expect(fsp.writeFile).toHaveBeenCalledWith(
        mockFilePath,
        JSON.stringify(mockTransactionFile),
        { encoding: 'utf8' },
      );
    });

    it('should write multiple transaction items', async () => {
      const mockFilePath = '/path/to/multi-output.json';
      const mockTransactionFile = multipleTransactionFile;
      vi.mocked(fsp.writeFile).mockResolvedValue(undefined);

      await writeTransactionFile(mockTransactionFile, mockFilePath);

      const expectedJson = JSON.stringify(mockTransactionFile);
      expect(fsp.writeFile).toHaveBeenCalledWith(mockFilePath, expectedJson, { encoding: 'utf8' });
    });

    it('should throw error when file cannot be written', async () => {
      const mockFilePath = '/invalid/path/output.json';
      const mockTransactionFile: TransactionFile = {
        network: 'testnet',
        items: [],
      };
      const mockError = new Error('EACCES: permission denied');

      vi.mocked(fsp.writeFile).mockRejectedValue(mockError);

      await expect(writeTransactionFile(mockTransactionFile, mockFilePath)).rejects.toThrow(
        mockError,
      );
    });
  });
});
