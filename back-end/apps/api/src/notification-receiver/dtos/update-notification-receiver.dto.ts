import { IsBoolean, IsDefined, IsNumber } from 'class-validator';

export class UpdateNotificationReceiverDto {
  @IsDefined()
  @IsNumber()
  id: number;

  @IsDefined()
  @IsBoolean()
  isRead: boolean;
}
