import * as fsp from 'fs/promises';
import type { TransactionFile } from '@shared/interfaces';

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

export async function readTransactionFile(filePath: string): Promise<TransactionFile> {
  const data = await fsp.readFile(filePath, { encoding: 'utf8' });
  return parseTransactionFile(JSON.parse(data));
}

export async function writeTransactionFile(
  transactionFile: TransactionFile,
  filePath: string,
): Promise<void> {
  const data = JSON.stringify(transactionFile);
  await fsp.writeFile(filePath, data, { encoding: 'utf8' });
}
