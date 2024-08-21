import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';

import { TransactionStatus } from '../database/entities';

export class SyncIndicatorsDto {
  @IsNumber()
  @IsNotEmpty()
  transactionId: number;

  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  transactionStatus: TransactionStatus;
}
