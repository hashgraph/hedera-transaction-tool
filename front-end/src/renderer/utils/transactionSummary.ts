import { type Transaction, TransferTransaction } from '@hiero-ledger/sdk';

import { formatHbarTransfers } from './transferTransactions';

/** Returns null for transaction types that do not yet have a summary. */
export function formatTransactionSummary(transaction: Transaction): string | null {
  if (!(transaction instanceof TransferTransaction)) return null;
  const parts: string[] = [];
  if (transaction.hbarTransfersList.length > 0) {
    parts.push(formatHbarTransfers(transaction.hbarTransfersList));
  }
  if (transaction.tokenTransfers.size > 0) parts.push('Token transfers');
  if (transaction.nftTransfers.size > 0) parts.push('NFT transfers');
  return parts.join(' · ') || 'No transfers';
}
