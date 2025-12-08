import { IsArray, IsNotEmpty, IsNumber } from 'class-validator';
import { NotificationReceiver } from '@entities';

export class NewNotificationDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsNotEmpty()
  @IsArray()
  notificationReceivers: NotificationReceiver[];
}