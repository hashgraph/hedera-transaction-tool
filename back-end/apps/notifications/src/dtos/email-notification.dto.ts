import { IsArray, IsNotEmpty, IsString } from 'class-validator';
import { Notification } from '@entities';

export class EmailNotificationDto {
  @IsNotEmpty()
  @IsString()
  email: string;

  @IsNotEmpty()
  @IsArray()
  notifications: Notification[];
}