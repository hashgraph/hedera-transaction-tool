import { Notification } from '@entities';
import {
  buildEmailTransactionsList,
  emailWarning,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

export const generateRemindSignersContent = (...notifications: Notification[]) => {
  if (notifications.length === 0) return "";

  const isPlural = notifications.length > 1;

  const transactions = notifications.map(n => ({
    transactionId: n.additionalData?.transactionId,
    network: getNetworkString(n.additionalData?.network),
    isManaul: undefined,
    validStart: n.additionalData?.validStart,
  }));

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
