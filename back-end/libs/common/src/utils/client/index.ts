import { Logger } from '@nestjs/common';

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

const logger = new Logger('NatsEmitHelpers');

const logPublishFailure = (subject: string, response: any) => {
  logger.warn(`Failed to emit ${subject}: ${response?.message ?? 'unknown error'}`);
};

export const emitTransactionStatusUpdate = async (
  publisher: NatsPublisherService,
  dtos: NotificationEventDto[],
) => {
  const result = await publisher.publish(TRANSACTION_STATUS_UPDATE, dtos);
  if (!result.success) logPublishFailure(TRANSACTION_STATUS_UPDATE, result.response);
};

export const emitTransactionUpdate = async (
  publisher: NatsPublisherService,
  dtos: NotificationEventDto[],
) => {
  const result = await publisher.publish(TRANSACTION_UPDATE, dtos);
  if (!result.success) logPublishFailure(TRANSACTION_UPDATE, result.response);
};

export const emitTransactionRemindSigners = async (
  publisher: NatsPublisherService,
  dtos: NotificationEventDto[],
  isManual = false,
) => {
  const subject = isManual ? TRANSACTION_REMIND_SIGNERS_MANUAL : TRANSACTION_REMIND_SIGNERS;
  const result = await publisher.publish(subject, dtos);
  if (!result.success) logPublishFailure(subject, result.response);
};

export const emitUserRegistrationEmail = async (
  publisher: NatsPublisherService,
  dtos: EmailDto[],
) => {
  const result = await publisher.publish(USER_INVITE, dtos);
  if (!result.success) logPublishFailure(USER_INVITE, result.response);
};

export const emitUserPasswordResetEmail = async (
  publisher: NatsPublisherService,
  dtos: EmailDto[],
) => {
  const result = await publisher.publish(USER_PASSWORD_RESET, dtos);
  if (!result.success) logPublishFailure(USER_PASSWORD_RESET, result.response);
};

export const emitUserStatusUpdateNotifications = async (
  publisher: NatsPublisherService,
  dto: NotificationEventDto,
) => {
  const result = await publisher.publish(USER_REGISTERED, dto);
  if (!result.success) logPublishFailure(USER_REGISTERED, result.response);
};

export const emitDismissedNotifications = async (
  publisher: NatsPublisherService,
  dtos: DismissedNotificationReceiverDto[],
) => {
  const result = await publisher.publish(DISMISSED_NOTIFICATIONS, dtos);
  if (!result.success) logPublishFailure(DISMISSED_NOTIFICATIONS, result.response);
};
