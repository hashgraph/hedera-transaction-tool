import { Notification } from '@entities';
import {
  emailBody,
  emailCardRow,
  emailCardTable,
  emailHeader,
  emailReviewButton, emailWarning,
  emailWrapper,
  escapeHtml,
} from '@app/common/templates/layout';

export const generateUserRegisteredMessage = (additionalData: Record<string, any>) => {
//   const { url, tempPassword } = additionalData;
//   return `You have been registered in Hedera Transaction Tool.
// The Organization URL is: <b>${url}</b>
// Your temporary password is: <b>${tempPassword}</b>`
  //TODO need to add the download url to additional data
  const downloadUrl = additionalData.downloadUrl || 'https://github.com/hashgraph/hedera-transaction-tool/releases/latest';
  return userInvitedEmail(additionalData.url, additionalData.tempPassword, downloadUrl);
}

export function generateNotifyUserRegisteredContent(...notifications: Notification[]): string {
  if (notifications.length === 0) return null;

  const emails = notifications.map(n => n.additionalData?.username).filter(Boolean);

  return userRegistrationCompletedEmail(emails);

  // const title =
  //   emails.length === 1 ? 'New user registration' : 'New user registrations';
  //
  // const introText =
  //   emails.length === 1
  //     ? `A user ${emails[0]} has successfully registered.`
  //     : 'The following users have successfully registered:';
  //
  // const listItems =
  //   emails.length > 1
  //     ? emails
  //       .map(
  //         (email) =>
  //           `<li style="margin:4px 0;font-size:14px;color:#333333;">${email}</li>`
  //       )
  //       .join('')
  //     : '';
  //
  // const listBlock =
  //   emails.length > 1
  //     ? `<ul style="margin:8px 0 0 18px;padding:0;">${listItems}</ul>`
  //     : '';
  //
  // return `
  // <!DOCTYPE html>
  // <html lang="en">
  //   <head>
  //     <meta charset="UTF-8" />
  //     <title>${title}</title>
  //   </head>
  //   <body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  //     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:24px 0;">
  //       <tr>
  //         <td align="center">
  //           <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">
  //             <tr>
  //               <td style="padding:20px 24px;background-color:#0b6efd;color:#ffffff;">
  //                 <h1 style="margin:0;font-size:20px;">${title}</h1>
  //               </td>
  //             </tr>
  //             <tr>
  //               <td style="padding:24px;">
  //                 <p style="margin:0 0 12px;font-size:16px;color:#333333;">
  //                   ${introText}
  //                 </p>
  //                 ${listBlock}
  //               </td>
  //             </tr>
  //             <tr>
  //               <td style="padding:16px 24px;border-top:1px solid #eeeeee;font-size:12px;color:#999999;text-align:center;">
  //                 This is an automated message. Please do not reply.
  //               </td>
  //             </tr>
  //           </table>
  //         </td>
  //       </tr>
  //     </table>
  //   </body>
  // </html>`;
}















export function emailDownloadButton(downloadUrl: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:32px;">
  <tr>
    <td>
      <a href=${downloadUrl}
         style="display:inline-block;padding:13px 28px;background:linear-gradient(135deg,#6611cc 0%,#8833ee 100%);
                color:#ffffff;font-family:'Trebuchet MS',Arial,sans-serif;font-size:14px;font-weight:700;
                text-decoration:none;border-radius:6px;letter-spacing:0.3px;white-space:nowrap;">
        Download App
      </a>
    </td>
  </tr>
</table>`;
}

export function emailGettingStarted(): string {
  return `
<p style="margin:32px 0 12px;font-size:13px;font-weight:700;color:#1a1a1a;letter-spacing:0.2px;">Get started</p>
<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;">
      <a href="#" style="font-size:13px;color:#7722ee;text-decoration:none;">How to get started with Hedera Transaction Tool</a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;">
      <a href="#" style="font-size:13px;color:#7722ee;text-decoration:none;">How to sign a transaction</a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;">
      <a href="#" style="font-size:13px;color:#7722ee;text-decoration:none;">How to create a transaction</a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;border-bottom:1px solid #eeeeee;">
      <a href="#" style="font-size:13px;color:#7722ee;text-decoration:none;">Understanding organizations and multi-key signing</a>
    </td>
  </tr>
</table>
`;
}

export function userInvitedEmailBody(url: string, tempPassword: string, downloadUrl: string): string {
  return `
<p style="margin:0 0 8px;font-size:15px;line-height:26px;color:#444444;">
  <strong style="color:#1a1a1a;">Hedera Transaction Tool</strong> is an application for creating,
  signing, and submitting transactions to Hedera networks. It supports multi-key signing workflows,
  real-time notifications for transactions awaiting your signature, and up-to-date account
  information pulled directly from the network.
</p>

<p style="margin:0 0 28px;font-size:15px;line-height:26px;color:#444444;">
  As a member of an organization, you can collaborate on transactions with others — transactions
  can be created and shared for others to sign as well.
</p>

<p style="margin:0 0 20px;font-size:15px;line-height:26px;color:#444444;">
  Use the details below to sign in for the first time:
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
  <tr>
    <td style="padding:12px 0 12px 16px;border-left:3px solid #9944ff;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9988bb;">Organization URL</p>
      <p style="margin:0;font-size:14px;font-family:monospace;color:#2d0072;">${escapeHtml(url)}</p>
    </td>
  </tr>
  <tr><td style="height:16px;"></td></tr>
  <tr>
    <td style="padding:12px 0 12px 16px;border-left:3px solid #9944ff;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9988bb;">Temporary Password</p>
      <p style="margin:0;font-size:14px;font-family:monospace;color:#2d0072;">${escapeHtml(tempPassword)}</p>
    </td>
  </tr>
</table>

${emailDownloadButton(downloadUrl)}
${emailGettingStarted()}
`;
}

export function userInvitedEmail(url: string, tempPassword: string, downloadUrl: string): string {
  const content = `
    ${emailHeader("Welcome to the Transaction Tool!", "Hedera Transaction Tool")}
    ${emailBody(userInvitedEmailBody(url, tempPassword, downloadUrl))}
  `;

  return emailWrapper(content);
}






export function emailUserList(emails: string[]): string {
  const rows = emails
    .map((email, i) =>
      emailCardRow(
        `
<td style="padding:15px 20px;__ROW_STYLE__
           font-size:14px;font-family:Arial,Helvetica,sans-serif;
           color:#2d0072;letter-spacing:0.2px;">
  ${escapeHtml(email)}
</td>
`,
        i
      )
    )
    .join("");

  return emailCardTable(rows);
}

export function userRegistrationCompletedEmail(emails: string[]): string {
  const count = emails.length;
  const isPlural = count > 1;

  const intro = `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  The following ${isPlural ? "accounts have" : "account has"} successfully completed registration:
</p>`;

  const bodyContent = `
    ${intro}
    ${emailUserList(emails)}
    ${emailWarning("If this wasn't expected, review the list of contacts in the Transaction Tool.")}
  `;

  const content = `
    ${emailHeader("New User Registration", "Hedera Transaction Tool")}
    ${emailBody(bodyContent)}
  `;

  return emailWrapper(content);
}