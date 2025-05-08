import { Notification } from '@entities';
import { getNetworkString } from '@app/common';

export const generateTransactionWaitingForSignaturesContent = (notification: Notification) => {
  const transactionId = notification.additionalData?.transactionId;
  const network = notification.additionalData?.network;

  return `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction.
  Transaction ID: ${transactionId}
  Network: ${getNetworkString(network)}`;
}