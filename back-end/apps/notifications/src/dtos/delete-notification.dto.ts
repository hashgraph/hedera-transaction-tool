import { IsArray, IsNotEmpty, IsNumber } from 'class-validator';

export class DeleteNotificationDto {
  @IsNotEmpty()
  @IsNumber()
  userId: number;

  @IsNotEmpty()
  @IsArray()
  notificationReceiverIds: number[];
}