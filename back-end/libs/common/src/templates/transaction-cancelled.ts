import {
  buildEmailTransactionsList,
  emailWarning,
  renderTransactionEmailLayout,
  TransactionNotification,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';
import { Notification } from '@entities';

export const generateTransactionCancelledContent = (...notifications: Notification[]) => {
  // if (notifications.length === 0) return null;
  //
  // const header =
  //   notifications.length === 1
  //     ? `A transaction has been cancelled.`
  //     : `Multiple transactions have been cancelled.`;
  //
  // const details = notifications.map(notification => {
  //   const transactionId = notification.additionalData?.transactionId;
  //   const network = notification.additionalData?.network;
  //
  //   return `Transaction ID: ${transactionId}\nNetwork: ${getNetworkString(network)}`;
  // }).join('\n\n');
  //
  // return `${header}\n\n${details}`;
  return transactionWaitingForSignaturesEmail2(
    notifications.map(n => ({
      transactionId: n.additionalData?.transactionId,
      network: getNetworkString(n.additionalData?.network),
    }))
  );
}

export function transactionWaitingForSignaturesEmail2(
  transactions: TransactionNotification[]
): string {
  if (transactions.length === 0) return "";

  const isPlural = transactions.length > 1;

  const intro = `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  ${
    isPlural
      ? "Multiple transactions have been canceled before being executed. Please visit the Hedera Transaction Tool to review the transactions if necessary."
      : "A transaction has been canceled before being executed. Please visit the Hedera Transaction Tool to review the transaction if necessary."
  }
</p>`;

  const bodyContent = `
    ${intro}
    ${buildEmailTransactionsList(transactions)}
    ${emailWarning("If this wasn't expected, please contact your administrator.")}
  `;

  return renderTransactionEmailLayout(
    "Transaction Signature Request",
    bodyContent
  );
}