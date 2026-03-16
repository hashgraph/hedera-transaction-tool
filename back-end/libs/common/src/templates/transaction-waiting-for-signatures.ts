import { Notification } from '@entities';
import {
  buildEmailTransactionsList,
  emailWarning,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

export const generateTransactionWaitingForSignaturesContent = (...notifications: Notification[]) => {
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
      ? "Multiple transactions require your review and signature. Please visit the Hedera Transaction Tool and locate the transactions."
      : "A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction."
  }
</p>`;

  const bodyContent = `
    ${intro}
    ${buildEmailTransactionsList(transactions)}
    ${emailWarning( "If this wasn't expected, please contact your administrator.")}
  `;

  return renderTransactionEmailLayout(
    "Transaction Signature Request",
    bodyContent
  );
}
