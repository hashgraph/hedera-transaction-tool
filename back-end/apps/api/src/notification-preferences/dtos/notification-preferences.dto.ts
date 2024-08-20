import { Expose } from 'class-transformer';

import { NotificationType } from '@entities';

export class NotificationPreferencesDto {
  @Expose()
  id: number;

  @Expose()
  userId: number;

  @Expose()
  type: NotificationType;

  @Expose()
  email: boolean;

  @Expose()
  inApp: boolean;
}
