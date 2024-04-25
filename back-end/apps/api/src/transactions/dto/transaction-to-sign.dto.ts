import { Expose, Type } from 'class-transformer';
import { TransactionDto } from './transaction.dto';
import { ApiProperty } from '@nestjs/swagger';

export class TransactionToSignDto {
  @Expose()
  @ApiProperty({ type: TransactionDto })
  @Type(() => TransactionDto)
  transaction: TransactionDto;

  @Expose()
  keysToSign: number[];
}
