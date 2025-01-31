import { NotifyGeneralDto } from '@app/common';
import { NotificationType, Transaction } from '@entities';

import { getNetwork } from '../transaction';

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
    content: `A transaction is about to expire and it has not collected the required signatures.
  Please visit the Hedera Transaction Tool and locate the transaction.
  Valid start: ${transaction.validStart.toUTCString()}
  Transaction ID: ${transaction.transactionId}
  Network: ${getNetwork(transaction)}`,
    entityId: transaction.id,
    actorId: null,
    userIds: receiverIds,
    recreateReceivers,
  };
};
