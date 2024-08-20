import { IsBoolean } from 'class-validator';

export class UpdateNotificationReceiverDto {
  @IsBoolean()
  isRead: boolean;
}
