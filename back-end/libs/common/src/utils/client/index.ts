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
import { NotificationType, TransactionStatus } from '@entities';

/* Chain */
export const emitUpdateTransactionStatus = (client: ClientProxy, id: number) => {
  client.emit<undefined, UpdateTransactionStatusDto>(UPDATE_TRANSACTION_STATUS, {
    id,
  });
};

export const emitExecuteTranasction = (client: ClientProxy, dto: ExecuteTransactionDto) => {
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
  network: string,
) => {
  client.emit<undefined, NotifyForTransactionDto>(NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES, {
    transactionId,
    network,
  });
};

export const notifySyncIndicators = (
  client: ClientProxy,
  transactionId: number,
  transactionStatus: TransactionStatus,
  network: string,
) => {
  client.emit<undefined, SyncIndicatorsDto>(SYNC_INDICATORS, {
    transactionId,
    transactionStatus,
    network,
  });
};

export const notifyGeneral = (
  client: ClientProxy,
  type: NotificationType,
  userIds: number[],
  content: string,
  entityId?: number,
) => {
  client.emit<undefined, NotifyGeneralDto>(NOTIFY_GENERAL, {
    type,
    userIds,
    content,
    entityId,
  });
};
