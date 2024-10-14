import { ClientProxy } from '@nestjs/microservices';

import {
  NOTIFY_CLIENT,
  NOTIFY_TRANSACTION_WAITING_FOR_SIGNATURES,
  TRANSACTION_ACTION,
  NotifyClientDto,
  NotifyForTransactionDto,
  SyncIndicatorsDto,
  SYNC_INDICATORS,
} from '@app/common';
import { TransactionStatus } from '@entities';

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
