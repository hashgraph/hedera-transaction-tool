import * as fsp from 'fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { setDialogMockState } from '../../../utils/runtime/dialogMocks.js';

type DialogMockPage = Parameters<typeof setDialogMockState>[0];

export async function selectEmptyTransactionFileForSigning(
  window: DialogMockPage,
): Promise<void> {
  const transactionFilePath = path.join(os.tmpdir(), 'empty-sign-transactions-file.tx2');

  await fsp.writeFile(
    transactionFilePath,
    JSON.stringify({ network: 'mainnet', items: [] }),
    'utf8',
  );

  await setDialogMockState(window, { openPaths: [transactionFilePath] });
}
