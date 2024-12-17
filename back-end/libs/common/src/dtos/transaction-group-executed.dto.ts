import { Expose } from 'class-transformer';
import { TransactionExecutedDto } from '@app/common';

export class TransactionGroupExecutedDto {
  @Expose()
  transactions: TransactionExecutedDto[];
}
