import {
  EMAIL_NOTIFICATIONS,
  FAN_OUT_DELETE_NOTIFICATIONS,
  FAN_OUT_NEW_NOTIFICATIONS,
  FAN_OUT_NOTIFY_CLIENTS,
  NatsPublisherService,
} from '@app/common';
import {
  DeleteNotificationDto,
  EmailNotificationDto,
  NewNotificationDto,
  NotifyClientDto,
} from '../dtos';

export const emitEmailNotifications = async (
  notificationsPublisher: NatsPublisherService,
  dtos: EmailNotificationDto[],
  onSuccess?: () => void,
  onError?: (error: any) => void,
) => {
  return await notificationsPublisher.publish(EMAIL_NOTIFICATIONS, dtos)
    .then((result) => {
    if (result.success) {
      if (onSuccess) {
        onSuccess();
      }
    } else {
      if (onError) {
        onError(result.response);
      }
    }
  });
}

export const emitNewNotifications = (
  notificationsPublisher: NatsPublisherService,
  dtos: NewNotificationDto[],
) => {
  return notificationsPublisher.publish(FAN_OUT_NEW_NOTIFICATIONS, dtos);
}

export const emitDeleteNotifications = (
  notificationsPublisher: NatsPublisherService,
  dtos: DeleteNotificationDto[],
) => {
  return notificationsPublisher.publish(FAN_OUT_DELETE_NOTIFICATIONS, dtos);
}

export const emitNotifyClients = (publisher: NatsPublisherService, userIds: NotifyClientDto[]) => {
  return publisher.publish(FAN_OUT_NOTIFY_CLIENTS, userIds);
}