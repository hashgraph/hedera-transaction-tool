import { generateResetPasswordMessage, resetPasswordEmailBody } from './reset-password';

jest.mock('@app/common/templates/layout', () => ({
  emailHeader: jest.fn((title, subtitle) => `<HEADER title="${title}" subtitle="${subtitle}">`),
  emailBody: jest.fn((content) => `<BODY>${content}</BODY>`),
  emailWarning: jest.fn((msg) => `<WARNING:${msg}>`),
  emailWrapper: jest.fn((content) => `<WRAPPER>${content}</WRAPPER>`),
  escapeHtml: jest.fn((str) => str), // pass-through; escapeHtml has its own tests
}));

import {
  emailHeader,
  emailBody,
  emailWarning,
  emailWrapper,
  escapeHtml,
} from '@app/common/templates/layout';

describe('reset-password templates', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

// ─── generateResetPasswordMessage ────────────────────────────────────────────

  describe('generateResetPasswordMessage', () => {
    it('returns the output of emailWrapper', () => {
      const result = generateResetPasswordMessage({ otp: '123456' });
      expect(result).toContain('<WRAPPER>');
    });

    it('calls emailHeader with correct title and subtitle', () => {
      generateResetPasswordMessage({ otp: '123456' });
      expect(emailHeader).toHaveBeenCalledWith('Password Reset', 'Hedera Transaction Tool');
    });

    it('calls emailBody once', () => {
      generateResetPasswordMessage({ otp: '123456' });
      expect(emailBody).toHaveBeenCalledTimes(1);
    });

    it('calls emailWrapper once', () => {
      generateResetPasswordMessage({ otp: '123456' });
      expect(emailWrapper).toHaveBeenCalledTimes(1);
    });

    it('passes otp from additionalData into the body', () => {
      generateResetPasswordMessage({ otp: 'ABC123' });
      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).toContain('ABC123');
    });

    it('ignores extra properties in additionalData', () => {
      expect(() =>
        generateResetPasswordMessage({ otp: '123456', extraProp: 'ignored', another: 99 })
      ).not.toThrow();
      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).not.toContain('ignored');
      expect(bodyArg).not.toContain('extraProp');
    });
  });

// ─── resetPasswordEmailBody ───────────────────────────────────────────────────

  describe('resetPasswordEmailBody', () => {
    it('includes the otp value', () => {
      const result = resetPasswordEmailBody('999999');
      expect(result).toContain('999999');
    });

    it('calls escapeHtml with the otp', () => {
      resetPasswordEmailBody('ABC123');
      expect(escapeHtml).toHaveBeenCalledWith('ABC123');
    });

    it('includes password reset instructions', () => {
      const result = resetPasswordEmailBody('123456');
      expect(result).toContain('reset your password');
    });

    it('includes the Reset Code label', () => {
      const result = resetPasswordEmailBody('123456');
      expect(result).toContain('Reset Code');
    });

    it('calls emailWarning with the ignore message', () => {
      resetPasswordEmailBody('123456');
      expect(emailWarning).toHaveBeenCalledWith(
        "If you didn't request a password reset, you can safely ignore this email."
      );
    });

    it('handles different OTP formats', () => {
      const otps = ['123456', 'ABCDEF', '1a2b3c', '999999'];
      otps.forEach(otp => {
        jest.clearAllMocks();
        const result = resetPasswordEmailBody(otp);
        expect(result).toContain(otp);
        expect(escapeHtml).toHaveBeenCalledWith(otp);
      });
    });
  });
});
