import { Expose } from 'class-transformer';

export class TransactionGroupItemDto {
  @Expose()
  transactionId: number;

  @Expose()
  groupId: number;

  @Expose()
  seq: number;
}