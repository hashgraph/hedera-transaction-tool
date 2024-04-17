import { Transaction } from '@entities';
import { Expose, Transform, Type } from 'class-transformer';

export class TranasctionExecutedDto {
  @Expose()
  @Type(() => Transaction)
  transaction: Transaction;

  @Expose()
  response?: string;

  @Expose()
  receipt?: string;

  @Expose()
  @Transform(({ obj }) => obj.body.toString('hex'))
  receiptBytes?: Buffer;

  @Expose()
  error?: string;
}
