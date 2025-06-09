import { IsBoolean, IsNumber } from 'class-validator';

export class UpdateNotificationReceiverDto {
  @IsNumber()
  id: number;

  @IsBoolean()
  isRead: boolean;
}
