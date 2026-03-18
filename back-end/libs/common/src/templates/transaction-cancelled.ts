import {
  buildEmailTransactionsList,
  emailWarning,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';
import { Notification } from '@entities';

export const generateTransactionCancelledContent = (...notifications: Notification[]) => {
  if (notifications.length === 0) return "";

  const isPlural = notifications.length > 1;

  const transactions = notifications.map(n => ({
    transactionId: n.additionalData?.transactionId,
    network: getNetworkString(n.additionalData?.network),
  }));

  const intro = `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  ${
    isPlural
      ? "Multiple transactions have been cancelled before being executed. Please visit the Hedera Transaction Tool to review the transactions if necessary."
      : "A transaction has been cancelled before being executed. Please visit the Hedera Transaction Tool to review the transaction if necessary."
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
