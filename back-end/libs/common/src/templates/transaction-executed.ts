import { renderTransactionEmailLayout } from '@app/common/templates/layout';
import { buildNetworkBreakdown } from '@app/common/templates/network';
import { Notification } from '@entities';

const SUCCESS_STATUS_CODES = new Set([0, 22, 104]);

export function isSuccessStatusCode(statusCode: unknown): boolean {
  if (typeof statusCode === 'number') {
    return Number.isFinite(statusCode) && SUCCESS_STATUS_CODES.has(statusCode);
  }
  if (typeof statusCode === 'string' && /^(0|[1-9]\d*)$/.test(statusCode)) {
    return SUCCESS_STATUS_CODES.has(Number(statusCode));
  }
  return false;
}

export function generateTransactionExecutedContent(...notifications: Notification[]): string {
  if (notifications.length === 0) return "";

  const successNotifications = notifications.filter(n => isSuccessStatusCode(n.additionalData?.statusCode));
  const failedNotifications = notifications.filter(n => !isSuccessStatusCode(n.additionalData?.statusCode));

  const successCount = successNotifications.length;
  const failedCount = failedNotifications.length;

  const sections: string[] = [];

  if (successCount > 0) {
    const noun = successCount === 1 ? 'transaction' : 'transactions';
    const breakdown = buildNetworkBreakdown(successNotifications);
    sections.push(`
<p style="margin:0 0 8px;font-size:15px;line-height:26px;color:#444444;">
  <strong>${successCount}</strong> ${noun} executed successfully.
</p>
${breakdown ? `<p style="margin:0 0 16px;font-size:14px;line-height:24px;color:#666666;">
  ${breakdown}
</p>` : ''}`);
  }

  if (failedCount > 0) {
    const noun = failedCount === 1 ? 'transaction' : 'transactions';
    const breakdown = buildNetworkBreakdown(failedNotifications);
    sections.push(`
<p style="margin:0 0 8px;font-size:15px;line-height:26px;color:#444444;">
  <strong>${failedCount}</strong> ${noun} failed to execute.
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
    "Transaction Executed",
    bodyContent
  );
}
