import { Expose, Type } from 'class-transformer';
import { TransactionDto } from './transaction.dto';

export class TransactionToSignDto {
  @Expose()
  @Type(() => TransactionDto)
  transaction: TransactionDto;

  @Expose()
  keysToSign: number[];
}
