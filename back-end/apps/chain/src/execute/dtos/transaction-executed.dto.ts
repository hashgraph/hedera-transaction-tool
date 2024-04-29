import { Expose, Transform } from 'class-transformer';

import { TransactionStatus } from '@app/common/database/entities';

export class TranasctionExecutedDto {
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
}
