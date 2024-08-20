import { IsBoolean, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

import { NotificationType } from '@entities';

export class UpdateNotificationPreferencesDto {
  @IsNotEmpty()
  @IsEnum(NotificationType)
  type: NotificationType;

  @IsBoolean()
  @IsOptional()
  email?: boolean;

  @IsBoolean()
  @IsOptional()
  inApp?: boolean;
}
