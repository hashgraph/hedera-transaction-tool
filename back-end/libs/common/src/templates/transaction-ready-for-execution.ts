import { Notification } from '@entities';
import { getNetworkString } from '@app/common';

export const generateTransactionReadyForExecutionContent = (...notifications: Notification[]) => {
  const header =
    notifications.length === 1
      ? `Transaction is ready for execution!`
      : `Multiple transactions are ready for execution!`;

  const details = notifications.map(notification => {
    const transactionId = notification.additionalData?.transactionId;
    const network = notification.additionalData?.network;

    return `Transaction ID: ${transactionId}\nNetwork: ${getNetworkString(network)}`;
  }).join('\n\n');

  return `${header}\n\n${details}`;
}
