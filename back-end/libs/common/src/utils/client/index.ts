import {
  DismissedNotificationReceiverDto,
  NatsPublisherService,
  NotificationEventDto,
  TRANSACTION_STATUS_UPDATE,
  TRANSACTION_UPDATE,
  TRANSACTION_REMIND_SIGNERS_MANUAL,
  TRANSACTION_REMIND_SIGNERS,
  USER_REGISTERED,
  USER_INVITE,
  USER_PASSWORD_RESET,
  EmailDto,
  DISMISSED_NOTIFICATIONS,
} from '@app/common';

//If it is to prevent an extra trip to the db, then need to decide if that is worth it or not
export const emitTransactionStatusUpdate = (
  publisher: NatsPublisherService,
  dtos: NotificationEventDto[],
) => {
  publisher.publish(TRANSACTION_STATUS_UPDATE, dtos);
};

export const emitTransactionUpdate = (
  publisher: NatsPublisherService,
  dtos: NotificationEventDto[],
) => {
  publisher.publish(TRANSACTION_UPDATE, dtos);
};

export const emitTransactionRemindSigners = (
  publisher: NatsPublisherService,
  dtos: NotificationEventDto[],
  isManual = false,
) => {
  publisher.publish(
    isManual ? TRANSACTION_REMIND_SIGNERS_MANUAL : TRANSACTION_REMIND_SIGNERS,
    dtos,
  );
};

export const emitUserRegistrationEmail = (
  publisher: NatsPublisherService,
  dtos: EmailDto[],
) => {
  publisher.publish(USER_INVITE, dtos);
};

export const emitUserPasswordResetEmail = (
  publisher: NatsPublisherService,
  dtos: EmailDto[],
) => {
  publisher.publish(USER_PASSWORD_RESET, dtos);
};

export const emitUserStatusUpdateNotifications = (
  publisher: NatsPublisherService,
  dto: NotificationEventDto,
) => {
  publisher.publish(USER_REGISTERED, dto);
};

export const emitDismissedNotifications = (
  publisher: NatsPublisherService,
  dtos: DismissedNotificationReceiverDto[]
) => {
  publisher.publish(DISMISSED_NOTIFICATIONS, dtos);
};
