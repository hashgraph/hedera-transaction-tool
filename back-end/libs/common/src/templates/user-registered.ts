import { Notification } from '@entities';

export const generateUserRegisteredMessage = (additionData: Record<string, any>) => {
  const { url, tempPassword } = additionData;
  return `You have been registered in Hedera Transaction Tool.
The Organization URL is: <b>${url}</b>
Your temporary password is: <b>${tempPassword}</b>`
}

export function generateNotifyUserRegisteredContent(notifications: Notification[]): string {
  const emails = notifications.map(n => n.additionalData?.email).filter(Boolean);

  const title =
    emails.length === 1 ? 'New user registration' : 'New user registrations';

  const introText =
    emails.length === 1
      ? `A user ${emails[0]} has successfully registered.`
      : 'The following users have successfully registered:';

  const listItems =
    emails.length > 1
      ? emails
        .map(
          (email) =>
            `<li style="margin:4px 0;font-size:14px;color:#333333;">${email}</li>`
        )
        .join('')
      : '';

  const listBlock =
    emails.length > 1
      ? `<ul style="margin:8px 0 0 18px;padding:0;">${listItems}</ul>`
      : '';

  return `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
              <tr>
                <td style="padding:20px 24px;background-color:#0b6efd;color:#ffffff;">
                  <h1 style="margin:0;font-size:20px;">${title}</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 12px;font-size:16px;color:#333333;">
                    ${introText}
                  </p>
                  ${listBlock}
                </td>
              </tr>
              <tr>
                <td style="padding:16px 24px;border-top:1px solid #eeeeee;font-size:12px;color:#999999;text-align:center;">
                  This is an automated message. Please do not reply.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>`;
}