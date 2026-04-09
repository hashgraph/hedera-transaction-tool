import {
  emailWarning,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { buildNetworkBreakdown } from '@app/common/templates/network';
import { Notification } from '@entities';

// Privacy invariant: only integer counts and normalized network labels may be
// interpolated into this template. Do not add transactionId, validStart, or
// statusCode — see 2520.
export const generateTransactionExpiredContent = (...notifications: Notification[]) => {
  if (notifications.length === 0) return "";

  const count = notifications.length;
  const nounPhrase = count === 1 ? 'transaction has' : 'transactions have';
  const breakdown = buildNetworkBreakdown(notifications);

  const intro = `
<p style="margin:0 0 16px;font-size:15px;line-height:26px;color:#444444;">
  <strong>${count}</strong> ${nounPhrase} expired before being executed.
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
    "Transaction Expired",
    bodyContent
  );
}
