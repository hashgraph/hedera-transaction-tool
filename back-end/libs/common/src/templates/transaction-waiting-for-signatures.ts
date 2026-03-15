import { Notification } from '@entities';
import {
  buildEmailTransactionsList,
  emailWarning,
  renderTransactionEmailLayout,
  TransactionNotification,
} from '@app/common/templates/layout';
import { getNetworkString } from '@app/common/templates/index';

export const generateTransactionWaitingForSignaturesContent = (...notifications: Notification[]) => {
  // if (notifications.length === 0) return null;
  //
  // const header =
  //   notifications.length === 1
  //     ? `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction.`
  //     : `Multiple transactions requires your review and signature. Please visit the Hedera Transaction Tool and locate the transactions.`;
  //
  // const details = notifications.map(notification => {
  //   const transactionId = notification.additionalData?.transactionId;
  //   const network = notification.additionalData?.network;
  //
  //   return `Transaction ID: ${transactionId}\nNetwork: ${getNetworkString(network)}`;
  // }).join('\n\n');
  //
  // return `${header}\n\n${details}`;
  return transactionWaitingForSignaturesEmail(
    notifications.map(n => ({
      transactionId: n.additionalData?.transactionId,
      network: getNetworkString(n.additionalData?.network),
    }))
  );
}


// ─── Component ────────────────────────────────────────────────────────────────

// export function emailTransactionList(
//   transactions: TransactionNotification[]
// ): string {
//   const rows = transactions
//     .map((tx, i) =>
//       emailCardRow(
//         `
// <td style="padding:13px 18px;__ROW_STYLE__
//            font-size:14px;font-family:Arial,Helvetica,sans-serif;
//            color:#2d0072;letter-spacing:0.2px;">
//   <span>
//     ${escapeHtml(tx.transactionId)}
//   </span>
//   <span style="margin-left:12px;
//                font-size:12px;
//                color:#7744aa;
//                background-color:rgba(119,68,170,0.08);
//                border-radius:4px;
//                padding:2px 8px;
//                display:inline-block;">
//     ${escapeHtml(tx.network)}
//   </span>
// </td>
// `,
//         i
//       )
//     )
//     .join("");
//
//   return emailCardTable(rows);
// }

// 2 columns - now in layout.ts
// export function emailTransactionList(
//   transactions: TransactionNotification[]
// ): string {
//   const rows = transactions
//     .map((tx, i) =>
//       emailCardRow(
//         `
// <td width="100%" style="padding:13px 18px;__ROW_STYLE__
//            font-size:14px;font-family:Arial,Helvetica,sans-serif;
//            color:#2d0072;letter-spacing:0.2px;">
//   ${escapeHtml(tx.transactionId)}
// </td>
//
// <td width="1%" nowrap align="right"
//     style="padding:13px 18px;__ROW_STYLE__
//            font-size:12px;font-family:Arial,Helvetica,sans-serif;">
//   <span style="background-color:rgba(119,68,170,0.08);
//                color:#7744aa;
//                border-radius:4px;
//                padding:2px 8px;
//                display:inline-block;">
//     ${escapeHtml(tx.network)}
//   </span>
// </td>
// `,
//         i
//       )
//     )
//     .join("");
//
//   return emailCardTable(rows);
// }

// ─── Template ─────────────────────────────────────────────────────────────────

export function transactionWaitingForSignaturesEmail(
  transactions: TransactionNotification[]
): string {
  if (transactions.length === 0) return "";

  const isPlural = transactions.length > 1;

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