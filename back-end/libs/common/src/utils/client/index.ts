import { ClientProxy } from '@nestjs/microservices';

import {
  NOTIFY_CLIENT,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  TRANSACTION_ACTION,
  NotifyClientDto,
  NotifyForTransactionDto,
  UPDATE_TRANSACTION_STATUS,
  UpdateTransactionStatusDto,
  SYNC_INDICATORS,
  SyncIndicatorsDto,
} from '@app/common';
import { TransactionStatus } from '@entities';

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
