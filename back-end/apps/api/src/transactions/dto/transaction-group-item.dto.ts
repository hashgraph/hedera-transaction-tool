import { Expose, Type } from 'class-transformer';
import { TransactionDto } from './transaction.dto';
import { TransactionGroupDto } from './transaction-group.dto';

export class TransactionGroupItemDto {
  @Expose()
  transactionId: number;

  @Expose()
  groupId: number;

  @Expose()
  @Type(() => TransactionGroupDto)
  group?: TransactionGroupDto;

  @Expose()
  seq: number;

  @Expose()
  @Type(() => TransactionDto)
  transaction: TransactionDto;
}
