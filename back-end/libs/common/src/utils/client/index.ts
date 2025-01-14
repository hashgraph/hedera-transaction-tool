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
  UpdateTransactionStatusDto,
  SyncIndicatorsDto,
  ExecuteTransactionDto,
} from '@app/common';
import { TransactionStatus } from '@entities';

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

export const notifyWaitingForSignatures = (client: ClientProxy, transactionId: number) => {
  client.emit<undefined, NotifyForTransactionDto>(NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES, {
    transactionId,
  });
};

export const notifySyncIndicators = (
  client: ClientProxy,
  transactionId: number,
  transactionStatus: TransactionStatus,
) => {
  client.emit<undefined, SyncIndicatorsDto>(SYNC_INDICATORS, {
    transactionId,
    transactionStatus,
  });
};
