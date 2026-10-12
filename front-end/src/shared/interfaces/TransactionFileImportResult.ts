import type { TransactionFile } from './TransactionFile';
import type { V1ImportFilterResult } from './V1ImportFilterResult';

export type TransactionFileImportResult =
  | { kind: 'tx2'; suggestedName: string; transactionFile: TransactionFile }
  | { kind: 'zip'; importResult: V1ImportFilterResult }
  | null;
