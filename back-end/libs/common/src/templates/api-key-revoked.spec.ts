import { generateApiKeyRevokedMessage } from './api-key-revoked';
import { ApiKeyRevokedReason } from '@entities';

jest.mock('@app/common/templates/layout', () => ({
  emailHeader: jest.fn((title, subtitle) => `<HEADER title="${title}" subtitle="${subtitle}">`),
  emailBody: jest.fn(content => `<BODY>${content}</BODY>`),
  emailWarning: jest.fn(msg => `<WARNING:${msg}>`),
  emailWrapper: jest.fn(content => `<WRAPPER>${content}</WRAPPER>`),
}));

import { emailHeader, emailBody, emailWarning, emailWrapper } from '@app/common/templates/layout';

describe('api-key-revoked templates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateApiKeyRevokedMessage', () => {
    it('returns the output of emailWrapper', () => {
      const result = generateApiKeyRevokedMessage({ reason: ApiKeyRevokedReason.INACTIVITY });
      expect(result).toContain('<WRAPPER>');
    });

    it('calls emailHeader with the correct title and subtitle', () => {
      generateApiKeyRevokedMessage({ reason: ApiKeyRevokedReason.INACTIVITY });
      expect(emailHeader).toHaveBeenCalledWith('Report API Key Revoked', 'Hedera Transaction Tool');
    });

    it('calls emailBody once', () => {
      generateApiKeyRevokedMessage({ reason: ApiKeyRevokedReason.INACTIVITY });
      expect(emailBody).toHaveBeenCalledTimes(1);
    });

    it('calls emailWrapper once', () => {
      generateApiKeyRevokedMessage({ reason: ApiKeyRevokedReason.INACTIVITY });
      expect(emailWrapper).toHaveBeenCalledTimes(1);
    });

    it('explains the inactivity reason, including idleExpiryDays, and offers the generate-new-key CTA', () => {
      generateApiKeyRevokedMessage({
        reason: ApiKeyRevokedReason.INACTIVITY,
        idleExpiryDays: 180,
      });

      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).toContain('it was unused for 180 days.');
      expect(emailWarning).toHaveBeenCalledWith(
        'If you still need report access, generate a new key from your account settings.',
      );
    });

    it('explains the permission-removed reason without instructing the user to generate a new key themselves', () => {
      generateApiKeyRevokedMessage({ reason: ApiKeyRevokedReason.PERMISSION_REMOVED });

      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).toContain('your report-viewing permission was removed by an admin.');

      const ctaArg = (emailWarning as jest.Mock).mock.calls[0][0];
      // Generating a replacement key is impossible while ineligible - the CTA must
      // route through an admin instead of telling the user to just do it themselves.
      expect(ctaArg).toContain('ask an administrator');
      expect(ctaArg).not.toBe(
        'If you still need report access, generate a new key from your account settings.',
      );
    });

    it('falls back to a generic explanation and the generate-new-key CTA for an unrecognized/missing reason', () => {
      generateApiKeyRevokedMessage({});

      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).toContain('it was revoked.');
      expect(emailWarning).toHaveBeenCalledWith(
        'If you still need report access, generate a new key from your account settings.',
      );
    });
  });
});
