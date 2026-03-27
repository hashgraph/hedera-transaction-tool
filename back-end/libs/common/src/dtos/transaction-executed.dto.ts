import { Expose, Transform } from 'class-transformer';

import { TransactionStatus } from '@entities';

export class TransactionExecutedDto {
  @Expose()
  status: TransactionStatus;

  @Expose()
  response?: string;

  @Expose()
  receipt?: string;

  @Expose()
  @Transform(({ obj }) => obj.receiptBytes.toString('hex'))
  receiptBytes?: Buffer;

  @Expose()
  error?: string;

  /** Internal flag — true when this pod's UPDATE actually changed the row */
  dbUpdateSucceeded?: boolean;
}
