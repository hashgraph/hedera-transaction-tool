import { Notification } from '@entities';
import { getNetworkString } from '@app/common';

export const generateRemindSignersContent = (...notifications: Notification[]) => {
  const header =
    notifications.length === 1
      ? `A transaction has not collected the required signatures and requires attention. 
      Please visit the Hedera Transaction Tool and locate the transaction.`
      : `Multiple transactions have not collected the required signatures and require attention. 
      Please visit the Hedera Transaction Tool and locate the transactions.`;

  const details = notifications.map(notification => {
    const validStartRaw = notification.additionalData?.validStart;
    let validStartDisplay: string;

    if (validStartRaw == null) {
      validStartDisplay = 'unknown';
    } else {
      const parsed = new Date(validStartRaw);
      validStartDisplay = isNaN(parsed.getTime()) ? String(validStartRaw) : parsed.toUTCString();
    }

    const transactionId = notification.additionalData?.transactionId;
    const network = notification.additionalData?.network;

    return `Valid start: ${validStartDisplay}
    Transaction ID: ${transactionId}
    Network: ${getNetworkString(network)}`;
  }).join('\n\n');

  return `${header}\n\n${details}`;
}
