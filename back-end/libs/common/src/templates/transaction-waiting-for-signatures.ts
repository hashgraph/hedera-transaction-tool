import { Notification } from '@entities';
import { getNetworkString } from '@app/common';

export const generateTransactionWaitingForSignaturesContent = (...notifications: Notification[]) => {
  if (notifications.length === 0) return null;

  const header =
    notifications.length === 1
      ? `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction.`
      : `Multiple transactions requires your review and signature. Please visit the Hedera Transaction Tool and locate the transactions.`;

  const details = notifications.map(notification => {
    const transactionId = notification.additionalData?.transactionId;
    const network = notification.additionalData?.network;

    return `Transaction ID: ${transactionId}\nNetwork: ${getNetworkString(network)}`;
  }).join('\n\n');

  return `${header}\n\n${details}`;
}
