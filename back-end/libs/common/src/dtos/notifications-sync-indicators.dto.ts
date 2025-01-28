import { IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

import { NotificationAdditionalData, TransactionStatus } from '../database/entities';

export class SyncIndicatorsDto {
  @IsNumber()
  @IsNotEmpty()
  transactionId: number;

  @IsOptional()
  additionalData?: NotificationAdditionalData;

  @IsNotEmpty()
  @IsEnum(TransactionStatus)
  transactionStatus: TransactionStatus;
}
