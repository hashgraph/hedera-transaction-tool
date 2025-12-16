import { getNetworkString } from '@app/common';
import { Notification, TransactionStatus } from '@entities';

function groupByStatus(
  notifications: Notification[],
): Map<string, Notification[]> {
  const map = new Map<string, Notification[]>();

  for (const n of notifications) {
    const status = (n.additionalData.status || 'UNKNOWN').toUpperCase();
    const list = map.get(status) ?? [];
    list.push(n);
    map.set(status, list);
  }

  return map;
}

export function generateTransactionExecutedContent(...notifications: Notification[]): string {
  if (notifications.length === 0) return null;

  const header =
    notifications.length === 1
      ? `Transaction has executed!`
      : `Multiple transactions have executed!`;

  const details = notifications.map(notification => {
    const status = notification.additionalData?.status ?? 'UNKNOWN';
    const transactionId = notification.additionalData?.transactionId;
    const network = notification.additionalData?.network;

    return `Status: ${status}\nTransaction ID: ${transactionId}\nNetwork: ${getNetworkString(network)}`;
  }).join('\n\n');

  return `${header}\n\n${details}`;
}

//TODO this should use TT colors. Make sure status separation is clear.
//executedAt and status values don't appear to be in the Notification.additionalData.
export function newGenerateTransactionExecutedContent(...notifications: Notification[]): string {
  if (notifications.length === 0) return null;

  const count = notifications.length;
  const title =
    count === 1
      ? 'Transaction execution result'
      : 'Transaction execution results';

  const introText =
    count === 1
      ? 'The following transaction executed:'
      : 'The following transactions executed:';

  const grouped = groupByStatus(notifications);

  const statusBlocks: string[] = [];

  for (const [statusKey, items] of grouped.entries()) {
    const isSuccess = statusKey === TransactionStatus.EXECUTED;
    const statusLabel = isSuccess
      ? 'Successful transactions'
      : statusKey.charAt(0) + statusKey.slice(1).toLowerCase() + ' transactions';

    const badgeBg = isSuccess ? '#d1fae5' : '#fee2e2';
    const badgeText = isSuccess ? '#166534' : '#b91c1c';

    const rows = items
      .map((n) => {
        const { transactionId, network, executedAt } = n.additionalData;
        const executedAtDate =
          executedAt instanceof Date ? executedAt : new Date(executedAt);
        const executedAtStr = executedAtDate.toLocaleString();

        return `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eeeeee;font-size:14px;color:#333333;">
              ${transactionId}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #eeeeee;font-size:14px;color:#555555;">
              ${getNetworkString(network)}
            </td>
            <td style="padding:8px 12px;border-bottom:1px solid #eeeeee;font-size:14px;color:#555555;">
              ${executedAtStr}
            </td>
          </tr>
        `;
      })
      .join('');

    statusBlocks.push(`
      <tr>
        <td style="padding:16px 20px 8px 20px;">
          <div style="margin-bottom:8px;">
            <span style="
              display:inline-block;
              padding:2px 10px;
              border-radius:999px;
              background-color:${badgeBg};
              color:${badgeText};
              font-weight:600;
              font-size:13px;
            ">
              ${statusLabel}
            </span>
          </div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <thead>
              <tr>
                <th align="left" style="padding:8px 12px;border-bottom:2px solid #0b6efd;font-size:13px;color:#0b6efd;text-transform:uppercase;letter-spacing:0.5px;">
                  Transaction ID
                </th>
                <th align="left" style="padding:8px 12px;border-bottom:2px solid #0b6efd;font-size:13px;color:#0b6efd;text-transform:uppercase;letter-spacing:0.5px;">
                  Network
                </th>
                <th align="left" style="padding:8px 12px;border-bottom:2px solid #0b6efd;font-size:13px;color:#0b6efd;text-transform:uppercase;letter-spacing:0.5px;">
                  Executed at
                </th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </td>
      </tr>
    `);
  }

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;">
        <tr>
          <td align="center" style="padding:12px 0 24px 0;">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
              <tr>
                <td style="padding:16px 20px;background-color:#0b6efd;color:#ffffff;">
                  <h1 style="margin:0;font-size:20px;">${title}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:16px 20px 8px 20px;">
                  <p style="margin:0 0 12px;font-size:15px;color:#333333;">
                    ${introText}
                  </p>
                </td>
              </tr>
              ${statusBlocks.join('')}
              <tr>
                <td style="padding:12px 20px;border-top:1px solid #eeeeee;font-size:12px;color:#999999;text-align:center;">
                  This is an automated message. Please do not reply.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
  `;
}