import { Notification } from '@entities';
import {
  emailBody,
  emailCardRow,
  emailCardTable,
  emailHeader,
  emailWarning,
  emailWrapper,
  escapeHtml,
} from '@app/common/templates/layout';

export const generateUserRegisteredMessage = (additionalData: Record<string, any>) => {
  const { url, tempPassword, downloadUrl } = additionalData;
  const content = `
    ${emailHeader("Welcome to the Transaction Tool!", "Hedera Transaction Tool")}
    ${emailBody(userInvitedEmailBody(url, tempPassword, downloadUrl))}
  `;

  return emailWrapper(content);
}

export function generateNotifyUserRegisteredContent(...notifications: Notification[]): string {
  if (notifications.length === 0) return null;

  const emails = notifications.map(n => n.additionalData?.username).filter(Boolean);

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
      <a href="https://transactiontool.hedera.com"
         style="font-size:13px;color:#7722ee;text-decoration:none;">
        Hedera Transaction Tool documentation
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;">
      <a href="https://transactiontool.hedera.com/general/install-new-users/account-setup"
         style="font-size:13px;color:#7722ee;text-decoration:none;">
        Setting up your account
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;border-bottom:1px solid #eeeeee;">
      <a href="https://transactiontool.hedera.com/keys"
         style="font-size:13px;color:#7722ee;text-decoration:none;">
        Managing keys
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;">
      <a href="https://transactiontool.hedera.com/general/creating-and-signing-a-transaction"
         style="font-size:13px;color:#7722ee;text-decoration:none;">
        Creating and signing a transaction
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;">
      <a href="https://transactiontool.hedera.com/general/transaction-status-tabs"
         style="font-size:13px;color:#7722ee;text-decoration:none;">
        Viewing transaction status and history
      </a>
    </td>
  </tr>
  <tr>
    <td style="padding:6px 0;border-top:1px solid #eeeeee;">
      <a href="https://transactiontool.hedera.com/accounts"
         style="font-size:13px;color:#7722ee;text-decoration:none;">
        Managing accounts
      </a>
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
