import { Expose, Type } from 'class-transformer';
import { NotificationDto } from './notification.dto';

export class NotificationReceiverDto {
  @Expose()
  id: number;

  @Expose()
  @Type(() => NotificationDto)
  notification: Notification;

  @Expose()
  notificationId: number;

  @Expose()
  isRead: boolean;

  @Expose()
  updatedAt: Date;
}
