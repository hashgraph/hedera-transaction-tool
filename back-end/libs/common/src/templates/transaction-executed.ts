import {
  emailCardRow,
  emailCardTable,
  escapeHtml,
  renderTransactionEmailLayout
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';
import { Notification } from '@entities';

export function generateTransactionExecutedContent(...notifications: Notification[]): string {
  if (notifications.length === 0) return "";

  const isPlural = notifications.length > 1;

  const transactions = notifications.map(n => ({
    transactionId: n.additionalData?.transactionId,
    network: getNetworkString(n.additionalData?.network),
    statusCode: n.additionalData?.statusCode,
  }));

  const intro = `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  ${
    isPlural
      ? "Multiple transactions have completed. Review the execution results below."
      : "A transaction has completed. Review the execution result below."
  }
</p>`;

  const bodyContent = `
    ${intro}
    ${emailExecutedTransactionList(transactions)}
  `;

  return renderTransactionEmailLayout(
    "Transaction Execution Results",
    bodyContent
  );
}

function getStatusBadgeStyles(statusCode: string): string {
  const code = Number(statusCode);

  if (Number.isFinite(code) && [0, 22, 104].includes(code)) {
    // SUCCESS
    return `
        background-color:rgba(46, 184, 92, 0.12);
        color:#2eb85c;
        border-radius:4px;
        padding:2px 8px;
        display:inline-block;
      `;
  } else {
    // FAILED
    return `
        background-color:rgba(220, 53, 69, 0.12);
        color:#dc3545;
        border-radius:4px;
        padding:2px 8px;
        display:inline-block;
      `;
  }
}

export function emailExecutedTransactionList(
  transactions: {
    transactionId?: string;
    network?: string;
    statusCode?: string;
  }[]
): string {
  const rows = transactions
    .map((tx, i) => {
      const status = tx.statusCode ?? "UNKNOWN";

      const statusStyles = getStatusBadgeStyles(status);

      return emailCardRow(
        `
<td width="100%" style="padding:13px 18px;__ROW_STYLE__
           font-size:14px;font-family:Arial,Helvetica,sans-serif;
           color:#2d0072;">
  ${escapeHtml(tx.transactionId ?? "")}
</td>

<td width="1%" nowrap style="padding:13px 18px;__ROW_STYLE__
           font-size:12px;font-family:Arial,Helvetica,sans-serif;">
  <span style="background-color:rgba(119,68,170,0.08);
               color:#7744aa;
               border-radius:4px;
               padding:2px 8px;
               display:inline-block;">
    ${escapeHtml(tx.network ?? "")}
  </span>
</td>

<td width="1%" nowrap align="right"
    style="padding:13px 18px;__ROW_STYLE__
           font-size:12px;font-family:Arial,Helvetica,sans-serif;">
  <span style="${statusStyles}">
    ${escapeHtml(status)}
  </span>
</td>
`,
        i
      );
    })
    .join("");

  return emailCardTable(rows);
}
