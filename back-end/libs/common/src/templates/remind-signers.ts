import { Notification } from '@entities';
import { getNetworkString } from '@app/common';

export const generateRemindSignersContent = (notification: Notification) => {
  const validStart = notification.additionalData?.validStart;
  const transactionId = notification.additionalData?.transactionId;
  const network = notification.additionalData?.network;

  return `A transaction has not collected the required signatures and requires attention.
  Please visit the Hedera Transaction Tool and locate the transaction.
  Valid start: ${validStart.toUTCString()}
  Transaction ID: ${transactionId}
  Network: ${getNetworkString(network)}`;
}