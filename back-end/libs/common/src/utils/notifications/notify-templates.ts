import { NotifyGeneralDto } from '@app/common';
import { NotificationType, Transaction } from '@entities';

export const getRemindSignersDTO = (
  transaction: Transaction,
  receiverIds: number[],
  manual: boolean,
  recreateReceivers?: boolean,
): NotifyGeneralDto => {
  return {
    type: manual
      ? NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER_MANUAL
      : NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER,
    entityId: transaction.id,
    actorId: null,
    userIds: receiverIds,
    recreateReceivers,
    additionalData: {
      validStart: transaction.validStart,
      transactionId: transaction.transactionId,
      network: transaction.mirrorNetwork,
    }
  };
};
