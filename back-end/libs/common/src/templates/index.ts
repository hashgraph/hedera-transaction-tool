import { Notification, NotificationType } from '@entities';
import { generateNotifyUserRegisteredContent } from '@app/common/templates/user-registered';
import { generateTransactionReadyForExecutionContent } from '@app/common/templates/transaction-ready-for-execution';
import { generateRemindSignersContent } from '@app/common/templates/remind-signers';
import {
  generateTransactionWaitingForSignaturesContent
} from '@app/common/templates/transaction-waiting-for-signatures';
import { generateTransactionCancelledContent } from '@app/common/templates/transaction-cancelled';

export * from './remind-signers';
export * from './reset-password';
export * from './transaction-ready-for-execution';
export * from './transaction-waiting-for-signatures';
export * from './user-registered';

export const generateEmailContent = (type: string | NotificationType, ...notifications: Notification[]) => {
  console.log(`generateEmailContent: ${type}`);
  switch (type) {
    case NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES:
      return generateTransactionWaitingForSignaturesContent(...notifications);
    case NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER:
      return generateRemindSignersContent(...notifications);
    case NotificationType.TRANSACTION_READY_FOR_EXECUTION:
      return generateTransactionReadyForExecutionContent(...notifications);
    case NotificationType.TRANSACTION_CANCELLED:
      return generateTransactionCancelledContent(...notifications);
    case NotificationType.USER_REGISTERED:
      return generateNotifyUserRegisteredContent(notifications);
    default:
      throw new Error(`Unknown email notification type: ${type}`);
  }
}

export const getNetworkString = (network: string) => {
  network = network.toLocaleLowerCase();
  switch (network) {
    case 'mainnet':
      return 'Mainnet';
    case 'testnet':
      return 'Testnet';
    case 'previewnet':
      return 'Previewnet';
    case 'local-node':
      return 'Local Node';
    default:
      return network;
  }
}