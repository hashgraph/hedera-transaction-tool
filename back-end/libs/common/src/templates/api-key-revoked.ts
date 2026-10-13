import {
  emailBody,
  emailHeader,
  emailWarning,
  emailWrapper,
} from '@app/common/templates/layout';
import { ApiKeyRevokedReason } from '@entities';

const GENERATE_NEW_KEY_CTA =
  'If you still need report access, generate a new key from your account settings.';

// USER and USER_REMOVED are omitted: those reasons never reach this template
// since api-keys.service.ts skips sending the email for them.
const REASON_COPY: Partial<
  Record<
    ApiKeyRevokedReason,
    (additionalData: Record<string, unknown>) => { explanation: string; cta: string }
  >
> = {
  [ApiKeyRevokedReason.PERMISSION_REMOVED]: () => ({
    explanation: 'your report-viewing permission was removed by an admin.',
    // Generating a replacement key isn't possible here: the settings section is
    // hidden and key creation is rejected for users without report eligibility.
    cta: 'If you still need report access, ask an administrator to restore your report-viewing permission, then generate a new key from your account settings.',
  }),
  [ApiKeyRevokedReason.INACTIVITY]: additionalData => ({
    explanation: `it was unused for ${additionalData.idleExpiryDays} days.`,
    cta: GENERATE_NEW_KEY_CTA,
  }),
};

export const generateApiKeyRevokedMessage = (additionalData: Record<string, unknown>) => {
  const reason = additionalData.reason as ApiKeyRevokedReason;
  const { explanation, cta } = REASON_COPY[reason]?.(additionalData) ?? {
    explanation: 'it was revoked.',
    cta: GENERATE_NEW_KEY_CTA,
  };

  const content = `
    ${emailHeader("Report API Key Revoked", "Hedera Transaction Tool")}
    ${emailBody(apiKeyRevokedEmailBody(explanation, cta))}
  `;

  return emailWrapper(content);
};

function apiKeyRevokedEmailBody(explanation: string, cta: string): string {
  return `
<p style="margin:0 0 24px;font-size:15px;line-height:26px;color:#444444;">
  Your Transaction Tool report API key has been revoked because ${explanation}
</p>
${emailWarning(cta)}
`;
}
