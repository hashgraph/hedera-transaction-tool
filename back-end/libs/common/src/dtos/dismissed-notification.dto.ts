import { IsNotEmpty, IsNumber } from 'class-validator';

export class DismissedNotificationReceiverDto {
  @IsNotEmpty()
  @IsNumber()
  id: number;

  @IsNotEmpty()
  @IsNumber()
  userId: number;
}