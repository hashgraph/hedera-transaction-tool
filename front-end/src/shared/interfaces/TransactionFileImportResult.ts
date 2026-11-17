import type { TransactionFile } from './TransactionFile';
import type { V1ImportFilterResult } from './V1ImportFilterResult';

export type TransactionFileImportResult =
  | { kind: 'tx2'; fileName: string; fileContent: TransactionFile }
  | { kind: 'zip'; importResult: V1ImportFilterResult }
  | null;
