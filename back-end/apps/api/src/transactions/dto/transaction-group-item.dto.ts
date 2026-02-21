import { Expose, Type } from 'class-transformer';
import { TransactionDto } from './transaction.dto';
import { TransactionGroupDto } from './transaction-group.dto';
import { TransactionGroup } from '@entities';

export class TransactionGroupItemDto {
  @Expose()
  transactionId: number;

  @Expose()
  groupId: number;

  @Expose()
  @Type(() => TransactionGroupDto)
  group: TransactionGroup;

  @Expose()
  seq: number;

  @Expose()
  @Type(() => TransactionDto)
  transaction: TransactionDto;
}
