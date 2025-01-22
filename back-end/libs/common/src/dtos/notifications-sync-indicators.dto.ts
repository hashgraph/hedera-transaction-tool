import { IsEnum, IsNotEmpty, IsNumber } from 'class-validator';

import { TransactionStatus } from '../database/entities';

export class SyncIndicatorsDto {
  @IsNumber()
  @IsNotEmpty()
  transactionId: number;

  @IsNotEmpty()
  network: string;

  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  transactionStatus: TransactionStatus;
}
