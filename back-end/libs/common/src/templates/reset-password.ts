import {
  emailBody,
  emailHeader,
  emailWarning,
  emailWrapper,
  escapeHtml,
} from '@app/common/templates/layout';

export const generateResetPasswordMessage = (additionalData: Record<string, any>) => {
  const { otp, serverUrl } = additionalData;

  const content = `
    ${emailHeader("Password Reset", "Hedera Transaction Tool")}
    ${emailBody(resetPasswordEmailBody(otp, serverUrl))}
  `;

  return emailWrapper(content);
}

export function resetPasswordEmailBody(otp: string, serverUrl?: string): string {
  const warningText = serverUrl
    ? `If you didn't request a password reset from ${serverUrl}, you can safely ignore this email.`
    : "If you didn't request a password reset, you can safely ignore this email.";

  return `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  To reset your password, use the verification code below:
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
  <tr>
    <td style="padding:12px 0 12px 16px;border-left:3px solid #9944ff;">
      <p style="margin:0 0 4px;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:#9988bb;">Reset Code</p>
      <p style="margin:0;font-size:20px;font-family:monospace;font-weight:700;color:#2d0072;letter-spacing:4px;">${escapeHtml(otp)}</p>
    </td>
  </tr>
</table>

${emailWarning(warningText)}
`;
}
