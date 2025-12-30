import * as fsp from 'fs/promises';
import { TransactionFile } from '../../shared/interfaces';

export async function readTransactionFile(filePath: string): Promise<TransactionFile> {
  const data = await fsp.readFile(filePath, { encoding: 'utf8' });
  return JSON.parse(data) as TransactionFile;
}

export async function writeTransactionFile(
  transactionFile: TransactionFile,
  filePath: string,
): Promise<void> {
  const data = JSON.stringify(transactionFile);
  await fsp.writeFile(filePath, data, { encoding: 'utf8' });
}
