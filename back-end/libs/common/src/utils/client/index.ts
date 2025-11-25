import { ClientProxy } from '@nestjs/microservices';

import {
  EXECUTE_TRANSACTION,
  NOTIFY_CLIENT,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  TRANSACTION_ACTION,
  UPDATE_TRANSACTION_STATUS,
  SYNC_INDICATORS,
  NotifyClientDto,
  NotifyForTransactionDto,
  NotifyGeneralDto,
  UpdateTransactionStatusDto,
  SyncIndicatorsDto,
  ExecuteTransactionDto,
  NOTIFY_GENERAL,
  NOTIFY_GENERAL_FANOUT,
} from '@app/common';
import { NotificationAdditionalData, NotificationType, TransactionStatus } from '@entities';

/* Chain */
export const emitUpdateTransactionStatus = (client: ClientProxy, id: number) => {
  client.emit<undefined, UpdateTransactionStatusDto>(UPDATE_TRANSACTION_STATUS, {
    id,
  });
};

/* Notifications */
export const notifyTransactionAction = (client: ClientProxy) => {
  client.emit<undefined, NotifyClientDto>(NOTIFY_CLIENT, {
    message: TRANSACTION_ACTION,
    content: '',
  });
};

export const notifyWaitingForSignatures = (
  client: ClientProxy,
  transactionId: number,
  additionalData?: NotificationAdditionalData,
) => {
  // Queue this email notification
  client.emit<undefined, NotifyForTransactionDto>(NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES, {
    transactionId,
    additionalData,
  });

  // Update sync indicators
  notifySyncIndicators(client, transactionId, TransactionStatus.WAITING_FOR_SIGNATURES, additionalData);
};


//this uses the status (new status?)
export const notifySyncIndicators = (
  client: ClientProxy,
  transactionId: number,
  transactionStatus: TransactionStatus,
  additionalData?: NotificationAdditionalData,
) => {
  client.emit<undefined, SyncIndicatorsDto>(SYNC_INDICATORS, {
    transactionId,
    transactionStatus,
    additionalData,
  });
};

// Temp, first pass. Determine which stream to use:
const emailBlacklistTypes = [
  NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
  NotificationType.TRANSACTION_INDICATOR_APPROVE,
  NotificationType.TRANSACTION_INDICATOR_SIGN,
  NotificationType.TRANSACTION_INDICATOR_EXECUTED,
  NotificationType.TRANSACTION_INDICATOR_EXPIRED,
  NotificationType.TRANSACTION_INDICATOR_CANCELLED,
  NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
  NotificationType.TRANSACTION_EXPIRED,
  NotificationType.USER_REGISTERED,
];

const inAppBlacklistTypes = [
  NotificationType.TRANSACTION_READY_FOR_EXECUTION,
  NotificationType.TRANSACTION_EXECUTED,
  NotificationType.TRANSACTION_CANCELLED,
  NotificationType.TRANSACTION_EXPIRED,
  NotificationType.TRANSACTION_CREATED,
  NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
];

//TODO there are a few that do appear to need the notification type, as they aren't directly
//related to transaction status, like remind singers, user registered etc.
export const notifyGeneral = (
  client: ClientProxy,
  type: NotificationType,
  userIds: number[],
  entityId?: number,
  recreateReceivers?: boolean,
  additionalData?: NotificationAdditionalData,
) => {
  if (!emailBlacklistTypes.includes(type)) {
    client.emit<undefined, NotifyGeneralDto>(NOTIFY_GENERAL, {
      type,
      userIds,
      entityId,
      recreateReceivers,
      additionalData,
    });
  }
  if (!inAppBlacklistTypes.includes(type)) {
    client.emit<undefined, NotifyGeneralDto>(NOTIFY_GENERAL_FANOUT, {
      type,
      userIds,
      entityId,
      recreateReceivers,
      additionalData,
    });
  }
};
