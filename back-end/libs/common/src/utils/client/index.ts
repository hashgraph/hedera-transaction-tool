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
} from '@app/common';
import { NotificationAdditionalData, NotificationType, TransactionStatus } from '@entities';

/* Chain */
export const emitUpdateTransactionStatus = (client: ClientProxy, id: number) => {
  client.emit<undefined, UpdateTransactionStatusDto>(UPDATE_TRANSACTION_STATUS, {
    id,
  });
};

export const emitExecuteTransaction = (client: ClientProxy, dto: ExecuteTransactionDto) => {
  client.emit<undefined, ExecuteTransactionDto>(EXECUTE_TRANSACTION, dto);
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
  client.emit<undefined, NotifyForTransactionDto>(NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES, {
    transactionId,
    additionalData,
  });
};

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

export const notifyGeneral = (
  client: ClientProxy,
  type: NotificationType,
  userIds: number[],
  entityId?: number,
  recreateReceivers?: boolean,
  additionalData?: NotificationAdditionalData,
) => {
  client.emit<undefined, NotifyGeneralDto>(NOTIFY_GENERAL, {
    type,
    userIds,
    entityId,
    recreateReceivers,
    additionalData,
  });
};
