import { Notification } from '@entities';
import {
  buildEmailTransactionsList, emailWarning, renderTransactionEmailLayout,
  TransactionNotification,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

export const generateRemindSignersContent = (...notifications: Notification[]) => {
  // if (notifications.length === 0) return null;
  //
  // const header =
  //   notifications.length === 1
  //     ? `A transaction has not collected the required signatures and requires attention.
  //     Please visit the Hedera Transaction Tool and locate the transaction.`
  //     : `Multiple transactions have not collected the required signatures and require attention.
  //     Please visit the Hedera Transaction Tool and locate the transactions.`;
  //
  // const details = notifications.map(notification => {
  //   const validStartRaw = notification.additionalData?.validStart;
  //   let validStartDisplay: string;
  //
  //   if (validStartRaw == null) {
  //     validStartDisplay = 'unknown';
  //   } else {
  //     const parsed = new Date(validStartRaw);
  //     validStartDisplay = isNaN(parsed.getTime()) ? String(validStartRaw) : parsed.toUTCString();
  //   }
  //
  //   const transactionId = notification.additionalData?.transactionId;
  //   const network = notification.additionalData?.network;
  //
  //   return `Valid start: ${validStartDisplay}
  //   Transaction ID: ${transactionId}
  //   Network: ${getNetworkString(network)}`;
  // }).join('\n\n');
  //
  // return `${header}\n\n${details}`;
  return remindSignersEmail(
    notifications.map(n => ({
      transactionId: n.additionalData?.transactionId,
      network: getNetworkString(n.additionalData?.network),
    }))
  );
}

export function remindSignersEmail(transactions: TransactionNotification[]): string {
  if (transactions.length === 0) return "";

  const isPlural = transactions.length > 1;

  const intro = `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  ${
    isPlural
      ? "The following transactions are still waiting on your signature. Please visit the Hedera Transaction Tool and sign at your earliest convenience."
      : "The following transaction is still waiting on your signature. Please visit the Hedera Transaction Tool and sign at your earliest convenience."
  }
</p>`;

  const bodyContent = `
    ${intro}
    ${buildEmailTransactionsList(transactions)}
    ${emailWarning("If this wasn't expected, please contact your administrator.")}
  `;

  return renderTransactionEmailLayout(
    "Signature Reminder",
    bodyContent
  );
}