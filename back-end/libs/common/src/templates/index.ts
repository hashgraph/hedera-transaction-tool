import { Notification, NotificationType } from '@entities';
import { generateNotifyUserRegisteredContent } from '@app/common/templates/user-registered';
import { generateTransactionReadyForExecutionContent } from '@app/common/templates/transaction-ready-for-execution';
import { generateRemindSignersContent } from '@app/common/templates/remind-signers';
import {
  generateTransactionWaitingForSignaturesContent
} from '@app/common/templates/transaction-waiting-for-signatures';

export * from './remind-signers';
export * from './reset-password';
export * from './transaction-ready-for-execution';
export * from './transaction-waiting-for-signatures';
export * from './user-registered';

export const generateNotificationContent = (notification: Notification) => {
  switch (notification.type) {
    case NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES:
      return generateTransactionWaitingForSignaturesContent(notification);
    case NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER:
      return generateRemindSignersContent(notification);
    case NotificationType.TRANSACTION_READY_FOR_EXECUTION:
      return generateTransactionReadyForExecutionContent(notification);
    case NotificationType.USER_REGISTERED:
      return generateNotifyUserRegisteredContent(notification);
    default:
      throw new Error(`Unknown notification type: ${notification.type}`);
  }
}

//todo where did this go?
export const getNetworkString = (network: string) => {
  switch (network) {
    case 'testnet':
      return 'Testnet';
    case 'mainnet':
      return 'Mainnet';
    case 'previewnet':
      return 'Previewnet';
    default:
      return network;
  }
}