import { getNetworkString } from '@app/common';
import { Notification } from '@entities';

export function generateTransactionExecutedContent(...notifications: Notification[]): string {
  if (notifications.length === 0) return null;

  const header =
    notifications.length === 1
      ? `Transaction has executed!`
      : `Multiple transactions have executed!`;

  const details = notifications.map(notification => {
    const statusCode = notification.additionalData?.statusCode;
    const transactionId = notification.additionalData?.transactionId;
    const network = notification.additionalData?.network;

    // For simplicity, we treat status codes 0, 22, and 104 as "SUCCESS", and everything else as "FAILED".
    const status = [0, 22, 104].includes(statusCode) ? 'SUCCESS' : 'FAILED';

    return `Status: ${status}\nTransaction ID: ${transactionId}\nNetwork: ${getNetworkString(network)}`;
  }).join('\n\n');

  return `${header}\n\n${details}`;
}