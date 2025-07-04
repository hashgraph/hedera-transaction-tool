import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator';
import { NotificationAdditionalData } from '@entities';

export class NotifyForTransactionDto {
  @IsNumber()
  @IsNotEmpty()
  transactionId: number;

  @IsOptional()
  additionalData?: NotificationAdditionalData;
}
