import { generateResetPasswordMessage } from '.';
import { ELECTRON_APP_PROTOCOL_PREFIX } from '@app/common';

describe('generateResetPasswordMessage', () => {
  it('should generate HTML with the provided OTP', () => {
    const otp = '123456';
    const result = generateResetPasswordMessage({ otp });

    expect(result).toContain(otp);
    expect(result).toContain(`<b>${otp}</b>`);
  });

  it('should include the Hedera Transaction Tool heading', () => {
    const result = generateResetPasswordMessage({ otp: '123456' });

    expect(result).toContain('<h1 style="margin: 0">Hedera Transaction Tool</h1>');
  });

  it('should include reset password instructions', () => {
    const result = generateResetPasswordMessage({ otp: '123456' });

    expect(result).toContain('Use the following token to reset your password:');
  });

  it('should include a verify link with the correct protocol and OTP', () => {
    const otp = 'ABC123';
    const result = generateResetPasswordMessage({ otp });

    expect(result).toContain(`href="${ELECTRON_APP_PROTOCOL_PREFIX}token=${otp}"`);
  });

  it('should include a styled verify button', () => {
    const result = generateResetPasswordMessage({ otp: '123456' });

    expect(result).toContain('background-color: #6600cc');
    expect(result).toContain('padding: 8px 22px');
    expect(result).toContain('border-radius: 6px');
    expect(result).toContain('>Verify</a>');
  });

  it('should handle different OTP formats', () => {
    const testCases = [
      '123456',
      'ABCDEF',
      '1a2b3c',
      '999999',
    ];

    testCases.forEach(otp => {
      const result = generateResetPasswordMessage({ otp });
      expect(result).toContain(otp);
      expect(result).toContain(`token=${otp}`);
    });
  });

  it('should return valid HTML structure', () => {
    const result = generateResetPasswordMessage({ otp: '123456' });

    expect(result).toContain('<div>');
    expect(result).toContain('</div>');
    expect(result).toContain('<h1');
    expect(result).toContain('</h1>');
    expect(result).toContain('<p');
    expect(result).toContain('</p>');
    expect(result).toContain('<a');
    expect(result).toContain('</a>');
  });

  it('should not be affected by additional data properties', () => {
    const result = generateResetPasswordMessage({
      otp: '123456',
      extraProp: 'ignored',
      anotherProp: 123,
    });

    expect(result).toContain('123456');
    expect(result).not.toContain('ignored');
    expect(result).not.toContain('extraProp');
  });

  it('should maintain consistent whitespace and formatting', () => {
    const result = generateResetPasswordMessage({ otp: '123456' });

    // Check that the structure is maintained
    const lines = result.split('\n').filter(line => line.trim());
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('<div>');
  });
});