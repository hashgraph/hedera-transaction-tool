import * as fsp from 'fs/promises';
import type { TransactionFileImportResult, TransactionFile } from '@shared/interfaces';
import { showTransactionOpenDialog, showTransactionSaveDialog } from '@main/modules/ipcHandlers/utils';
import { filterForImportV1 } from '@main/services/localUser/importV1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseTransactionFile(value: unknown): TransactionFile {
  if (
    !isRecord(value) ||
    typeof value.network !== 'string' ||
    value.network.trim().length === 0 ||
    !Array.isArray(value.items)
  ) {
    throw new Error('Invalid transaction file: unsupported format or network');
  }

  const networkScheme = value.network.match(/^([a-z][a-z\d+.-]*):\/\//i)?.[1];
  if (networkScheme && networkScheme.toLowerCase() !== 'https') {
    throw new Error('Invalid transaction file network: HTTPS is required');
  }

  for (const item of value.items) {
    if (
      !isRecord(item) ||
      typeof item.transactionBytes !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.description !== 'string' ||
      typeof item.creatorEmail !== 'string'
    ) {
      throw new Error('Invalid transaction file: invalid transaction item');
    }
  }

  return value as unknown as TransactionFile;
}

export async function importTransactionFile(onlyV2 = false): Promise<TransactionFileImportResult> {
  const result = await showTransactionOpenDialog(onlyV2);
  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  const extension = filePath.split('.').pop()?.toLowerCase();
  if (extension === 'zip' && !onlyV2) {
    const importResult = await filterForImportV1([filePath]);
    return {
      kind: 'zip',
      importResult: {
        candidates: importResult.candidates.map(candidate => ({
          ...candidate,
          filePath: candidate.filePath.split(/[\\/]/).pop() ?? candidate.filePath,
        })),
        ignoredPaths: importResult.ignoredPaths.map(ignoredPath =>
          ignoredPath.split(/[\\/]/).pop() ?? ignoredPath,
        ),
      },
    };
  }
  if (extension !== 'tx2') {
    throw new Error('Unsupported transaction file extension');
  }

  const transactionFile = await readSelectedTransactionFile(filePath);
  const suggestedName = filePath.split(/[\\/]/).pop() ?? 'transaction.tx2';
  return { kind: 'tx2', suggestedName, transactionFile };
}

async function readSelectedTransactionFile(filePath: string): Promise<TransactionFile> {
  const data = await fsp.readFile(filePath, { encoding: 'utf8' });
  return parseTransactionFile(JSON.parse(data));
}

export async function exportTransactionFile(
  transactionFile: TransactionFile,
  defaultName: string,
): Promise<boolean> {
  const result = await showTransactionSaveDialog(defaultName);
  if (result.canceled || !result.filePath) {
    return false;
  }
  await fsp.writeFile(result.filePath, JSON.stringify(transactionFile), { encoding: 'utf8' });
  return true;
}
