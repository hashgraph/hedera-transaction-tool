import { Notification } from '@entities';
import {
  buildEmailTransactionsList,
  renderTransactionEmailLayout,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

export const generateTransactionReadyForExecutionContent = (...notifications: Notification[]) => {
    if (notifications.length === 0) return "";

  const isPlural = notifications.length > 1;

  const transactions = notifications.map(n => ({
    transactionId: n.additionalData?.transactionId,
    network: getNetworkString(n.additionalData?.network),
    isManual: n.additionalData?.isManual ?? false,
    validStart: n.additionalData?.validStart,
  }));

  const manualTransactions = transactions.filter(t => t.isManual);
  const automaticTransactions = transactions.filter(t => !t.isManual);

  const hasManual = manualTransactions.length > 0;
  const hasAutomatic = automaticTransactions.length > 0;

  // ─── Intro ─────────────────────────────────────────────

  const intro = `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  ${
    hasManual
      ? isPlural
        ? "Some transactions require manual submission. Please visit the Hedera Transaction Tool to review and submit them."
        : "This transaction requires manual submission. Please visit the Hedera Transaction Tool to review and submit it."
      : isPlural
        ? "Multiple transactions are ready for execution. You may visit the Hedera Transaction Tool to review the transactions."
        : "A transaction is ready for execution. You may visit the Hedera Transaction Tool to review the transaction."
  }
</p>`;

  // ─── Sections ──────────────────────────────────────────

  let sections = "";

  if (hasManual) {
    sections += `
<h3 style="margin:0 0 12px;font-size:14px;
           font-family:Arial,Helvetica,sans-serif;
           color:#2d0072;">
  Manual Submission Required
</h3>

<p style="margin:0 0 16px;font-size:13px;line-height:22px;color:#555555;">
  These transactions must be manually submitted through the Hedera Transaction Tool.
</p>

${buildEmailTransactionsList(manualTransactions)}
`;
  }

  if (hasAutomatic) {
    sections += `
<h3 style="margin:${hasManual ? "28px" : "0"} 0 12px;font-size:14px;
           font-family:Arial,Helvetica,sans-serif;
           color:#2d0072;">
  Ready for Automatic Execution
</h3>

<p style="margin:0 0 16px;font-size:13px;line-height:22px;color:#555555;">
  These transactions are ready and will be executed automatically.
</p>

${buildEmailTransactionsList(automaticTransactions)}
`;
  }

  const bodyContent = `
    ${intro}
    ${sections}
  `;

  return renderTransactionEmailLayout(
    "Transactions Ready for Execution",
    bodyContent
  );
}
