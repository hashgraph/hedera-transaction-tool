import { Notification } from '@entities';
import { renderTransactionEmailLayout } from '@app/common/templates/layout';
import { buildNetworkBreakdown } from '@app/common/templates/network';

// Privacy invariant: only integer counts and normalized network labels may be
// interpolated into this template. Do not add transactionId, validStart, or
// statusCode — see 2520.
export const generateTransactionReadyForExecutionContent = (...notifications: Notification[]) => {
  if (notifications.length === 0) return "";

  const manualNotifications = notifications.filter(n => n.additionalData?.isManual === true);
  const automaticNotifications = notifications.filter(n => n.additionalData?.isManual !== true);

  const manualCount = manualNotifications.length;
  const automaticCount = automaticNotifications.length;

  const sections: string[] = [];

  if (manualCount > 0) {
    const verbPhrase = manualCount === 1 ? 'transaction requires' : 'transactions require';
    const breakdown = buildNetworkBreakdown(manualNotifications);
    sections.push(`
<p style="margin:0 0 8px;font-size:15px;line-height:26px;color:#444444;">
  <strong>${manualCount}</strong> ${verbPhrase} manual submission.
</p>
${breakdown ? `<p style="margin:0 0 16px;font-size:14px;line-height:24px;color:#666666;">
  ${breakdown}
</p>` : ''}`);
  }

  if (automaticCount > 0) {
    const verbPhrase =
      automaticCount === 1
        ? 'transaction is ready and will be executed automatically'
        : 'transactions are ready and will be executed automatically';
    const breakdown = buildNetworkBreakdown(automaticNotifications);
    sections.push(`
<p style="margin:0 0 8px;font-size:15px;line-height:26px;color:#444444;">
  <strong>${automaticCount}</strong> ${verbPhrase}.
</p>
${breakdown ? `<p style="margin:0 0 16px;font-size:14px;line-height:24px;color:#666666;">
  ${breakdown}
</p>` : ''}`);
  }

  const cta = `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  View details in the Hedera Transaction Tool.
</p>`;

  const bodyContent = `
    ${sections.join('')}
    ${cta}
  `;

  return renderTransactionEmailLayout(
    "Transactions Ready for Execution",
    bodyContent
  );
}
