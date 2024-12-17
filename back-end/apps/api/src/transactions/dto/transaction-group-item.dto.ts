import { Expose, Type } from 'class-transformer';
import { TransactionDto } from './transaction.dto';

export class TransactionGroupItemDto {
  @Expose()
  transactionId: number;

  @Expose()
  groupId: number;

  @Expose()
  seq: number;

  @Expose()
  @Type(() => TransactionDto)
  transaction: TransactionDto;
}
