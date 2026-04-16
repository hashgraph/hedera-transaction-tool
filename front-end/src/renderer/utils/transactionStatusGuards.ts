import { TransactionStatus } from '@shared/interfaces';

export const isInProgressStatus = (status: TransactionStatus | null | undefined): boolean =>
  [TransactionStatus.NEW, TransactionStatus.WAITING_FOR_EXECUTION, TransactionStatus.WAITING_FOR_SIGNATURES]
    .includes(status as TransactionStatus);

export const isSignableStatus = (status: TransactionStatus | null | undefined): boolean =>
  [TransactionStatus.WAITING_FOR_SIGNATURES, TransactionStatus.WAITING_FOR_EXECUTION].includes(
    status as TransactionStatus,
  );

export const isApprovableStatus = (status: TransactionStatus | null | undefined): boolean =>
  [TransactionStatus.WAITING_FOR_SIGNATURES, TransactionStatus.WAITING_FOR_EXECUTION].includes(
    status as TransactionStatus,
  );
