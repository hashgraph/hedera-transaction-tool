import { TransactionStatus } from '@entities';

export const TRANSACTION_STATUS_COLLECTIONS: Record<string, TransactionStatus[]> = {
  READY_FOR_REVIEW: [TransactionStatus.WAITING_FOR_SIGNATURES],

  READY_TO_SIGN: [
    TransactionStatus.WAITING_FOR_SIGNATURES,
    TransactionStatus.WAITING_FOR_EXECUTION,
  ],

  READY_FOR_EXECUTION: [TransactionStatus.WAITING_FOR_EXECUTION],

  IN_PROGRESS: [TransactionStatus.WAITING_FOR_SIGNATURES],

  // Terminal states - transactions that are "done"
  HISTORY: [
    TransactionStatus.EXECUTED,
    TransactionStatus.FAILED,
    TransactionStatus.EXPIRED,
    TransactionStatus.CANCELED,
    TransactionStatus.ARCHIVED,
  ],
};
