import {
  emailBody,
  emailHeader,
  emailWarning,
  emailWrapper,
} from '@app/common/templates/layout';
import { ApiKeyRevokedReason } from '@entities';

// USER and USER_REMOVED are omitted: those reasons never reach this template
// since api-keys.service.ts skips sending the email for them.
const REASON_COPY: Partial<Record<ApiKeyRevokedReason, (additionalData: Record<string, unknown>) => string>> = {
  [ApiKeyRevokedReason.PERMISSION_REMOVED]: () =>
    'your report-viewing permission was removed by an admin.',
  [ApiKeyRevokedReason.INACTIVITY]: additionalData =>
    `it was unused for ${additionalData.idleExpiryDays} days.`,
};

export const generateApiKeyRevokedMessage = (additionalData: Record<string, unknown>) => {
  const reason = additionalData.reason as ApiKeyRevokedReason;
  const explanation = REASON_COPY[reason]?.(additionalData) ?? 'it was revoked.';

  const content = `
    ${emailHeader("Report API Key Revoked", "Hedera Transaction Tool")}
    ${emailBody(apiKeyRevokedEmailBody(explanation))}
  `;

  return emailWrapper(content);
};

function apiKeyRevokedEmailBody(explanation: string): string {
  return `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  Your Transaction Tool report API key has been revoked because ${explanation}
</p>
${emailWarning("If you still need report access, generate a new key from your account settings.")}
`;
}
