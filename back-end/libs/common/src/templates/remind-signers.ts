import { Notification } from '@entities';
import {
  emailWarning,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { buildNetworkBreakdown } from '@app/common/templates/network';

export const generateRemindSignersContent = (...notifications: Notification[]) => {
  if (notifications.length === 0) return "";

  const count = notifications.length;
  const noun = count === 1 ? 'transaction' : 'transactions';
  const breakdown = buildNetworkBreakdown(notifications);

  const intro = `
<p style="margin:0 0 16px;font-size:15px;line-height:26px;color:#444444;">
  You still have <strong>${count}</strong> ${noun} waiting for your signature.
</p>
${breakdown ? `<p style="margin:0 0 16px;font-size:14px;line-height:24px;color:#666666;">
  ${breakdown}
</p>` : ''}
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  View details in the Hedera Transaction Tool.
</p>`;

  const bodyContent = `
    ${intro}
    ${emailWarning("If this wasn't expected, please contact your administrator.")}
  `;

  return renderTransactionEmailLayout(
    "Signature Reminder",
    bodyContent
  );
}
