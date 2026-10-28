import { TransactionStatus } from '@entities';

export const TRANSACTION_STATUS_COLLECTIONS: Record<string, TransactionStatus[]> = {
  READY_FOR_REVIEW: [TransactionStatus.READY_FOR_REVIEW],

  // READY_FOR_REVIEW is included so signers always receive transactions they're eligible to
  // sign, even while review is pending — the frontend decides whether to show them by default.
  READY_TO_SIGN: [
    TransactionStatus.WAITING_FOR_SIGNATURES,
    TransactionStatus.WAITING_FOR_EXECUTION,
    TransactionStatus.READY_FOR_REVIEW,
  ],

  READY_FOR_EXECUTION: [TransactionStatus.WAITING_FOR_EXECUTION],

  IN_PROGRESS: [TransactionStatus.WAITING_FOR_SIGNATURES, TransactionStatus.READY_FOR_REVIEW],

  // Terminal states - transactions that are "done"
  HISTORY: [
    TransactionStatus.EXECUTED,
    TransactionStatus.FAILED,
    TransactionStatus.EXPIRED,
    TransactionStatus.CANCELED,
    TransactionStatus.ARCHIVED,
  ],
};
