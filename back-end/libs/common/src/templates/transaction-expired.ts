import { getNetworkString } from '@app/common';
import { Notification } from '@entities';

export const generateTransactionExpiredContent = (...notifications: Notification[]) => {
  if (notifications.length === 0) return null;

  const header =
    notifications.length === 1
      ? `A transaction has expired.`
      : `Multiple transactions have expired.`;

  const details = notifications.map(notification => {
    const transactionId = notification.additionalData?.transactionId;
    const network = notification.additionalData?.network;

    return `Transaction ID: ${transactionId}\nNetwork: ${getNetworkString(network)}`;
  }).join('\n\n');

  return `${header}\n\n${details}`;
}