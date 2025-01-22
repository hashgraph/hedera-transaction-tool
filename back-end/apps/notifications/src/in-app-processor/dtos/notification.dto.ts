import { Expose } from 'class-transformer';

import { NotificationAdditionalData, NotificationType } from '@entities';

export class NotificationDto {
  @Expose()
  id: number;

  @Expose()
  type: NotificationType;

  @Expose()
  content: string;

  @Expose()
  entityId?: number;

  @Expose()
  actorId?: number;

  @Expose()
  additionalData?: NotificationAdditionalData;

  @Expose()
  createdAt: Date;
}
