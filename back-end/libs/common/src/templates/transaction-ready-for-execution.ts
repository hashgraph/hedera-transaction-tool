import { Notification } from '@entities';
import { getNetworkString } from '@app/common';

export const generateTransactionReadyForExecutionContent = (notification: Notification) => {
  const transactionId = notification.additionalData?.transactionId;
  const network = notification.additionalData?.network;

  return `Transaction is ready for execution!
  Transaction ID: ${transactionId}
  Network: ${getNetworkString(network)}`;
}