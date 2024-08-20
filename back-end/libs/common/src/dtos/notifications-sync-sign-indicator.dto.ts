import { IsNotEmpty, IsNumber } from 'class-validator';

export class SyncSignIndicatorNotificationDto {
  @IsNumber()
  @IsNotEmpty()
  transactionId: number;
}
