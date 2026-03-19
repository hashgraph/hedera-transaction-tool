import {
  generateUserRegisteredMessage,
  generateNotifyUserRegisteredContent,
  emailUserList,
  userInvitedEmailBody,
  emailDownloadButton,
  emailGettingStarted,
} from '.';
import { Notification } from '@entities';

jest.mock('@app/common/templates/layout', () => ({
  emailHeader: jest.fn((title, subtitle) => `<HEADER title="${title}" subtitle="${subtitle}">`),
  emailBody: jest.fn((content) => `<BODY>${content}</BODY>`),
  emailWarning: jest.fn((msg) => `<WARNING:${msg}>`),
  emailWrapper: jest.fn((content) => `<WRAPPER>${content}</WRAPPER>`),
  emailCardRow: jest.fn((cells, index) => `<ROW index="${index}">${cells}</ROW>`),
  emailCardTable: jest.fn((rows) => `<TABLE>${rows}</TABLE>`),
  escapeHtml: jest.fn((str) => str ?? ''),
}));

import {
  emailHeader,
  emailBody,
  emailWarning,
  emailWrapper,
  emailCardRow,
  emailCardTable,
  escapeHtml,
} from '@app/common/templates/layout';

describe('user-registered templates', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

// ─── generateUserRegisteredMessage ───────────────────────────────────────────

  describe('generateUserRegisteredMessage', () => {
    it('returns the output of emailWrapper', () => {
      const result = generateUserRegisteredMessage({ url: 'https://example.com', tempPassword: 'pass123', downloadUrl: 'https://test.download.com' });
      expect(result).toContain('<WRAPPER>');
    });

    it('calls emailHeader with correct title and subtitle', () => {
      generateUserRegisteredMessage({ url: 'https://example.com', tempPassword: 'pass123', downloadUrl: 'https://test.download.com' });
      expect(emailHeader).toHaveBeenCalledWith('Welcome to the Transaction Tool!', 'Hedera Transaction Tool');
    });

    it('calls emailBody once', () => {
      generateUserRegisteredMessage({ url: 'https://example.com', tempPassword: 'pass123', downloadUrl: 'https://test.download.com' });
      expect(emailBody).toHaveBeenCalledTimes(1);
    });

    it('includes the url in the body', () => {
      generateUserRegisteredMessage({ url: 'https://example.com', tempPassword: 'pass123', downloadUrl: 'https://test.download.com' });
      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).toContain('https://example.com');
    });

    it('includes the tempPassword in the body', () => {
      generateUserRegisteredMessage({ url: 'https://example.com', tempPassword: 'S3cr3t!', downloadUrl: 'https://test.download.com' });
      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).toContain('S3cr3t!');
    });

    it('includes the downloadUrl in the body', () => {
      generateUserRegisteredMessage({ url: 'https://example.com', tempPassword: 'pass123', downloadUrl: 'https://test.download.com' });
      const bodyArg = (emailBody as jest.Mock).mock.calls[0][0];
      expect(bodyArg).toContain('https://test.download.com');
    });

    it('escapes url and tempPassword', () => {
      generateUserRegisteredMessage({ url: '<script>', tempPassword: '"pass"', downloadUrl: 'https://test.download.com' });
      expect(escapeHtml).toHaveBeenCalledWith('<script>');
      expect(escapeHtml).toHaveBeenCalledWith('"pass"');
    });

    it('handles undefined url and tempPassword without throwing', () => {
      expect(() => generateUserRegisteredMessage({ url: undefined, tempPassword: undefined })).not.toThrow();
    });
  });

// ─── generateNotifyUserRegisteredContent ─────────────────────────────────────

  describe('generateNotifyUserRegisteredContent', () => {
    it('returns null for empty notifications array', () => {
      expect(generateNotifyUserRegisteredContent()).toBeNull();
    });

    it('does not call layout utilities when empty', () => {
      generateNotifyUserRegisteredContent();
      expect(emailWrapper).not.toHaveBeenCalled();
    });

    it('returns the output of emailWrapper', () => {
      const notification = { additionalData: { username: 'user@example.com' } } as unknown as Notification;
      const result = generateNotifyUserRegisteredContent(notification);
      expect(result).toContain('<WRAPPER>');
    });

    it('calls emailHeader with correct title and subtitle', () => {
      const notification = { additionalData: { username: 'user@example.com' } } as unknown as Notification;
      generateNotifyUserRegisteredContent(notification);
      expect(emailHeader).toHaveBeenCalledWith('New User Registration', 'Hedera Transaction Tool');
    });

    it('uses singular copy for one valid email', () => {
      const notification = { additionalData: { username: 'user@example.com' } } as unknown as Notification;
      const result = generateNotifyUserRegisteredContent(notification);
      expect(result).toContain('account has');
      expect(result).not.toContain('accounts have');
    });

    it('uses plural copy for multiple valid emails', () => {
      const n1 = { additionalData: { username: 'a@example.com' } } as unknown as Notification;
      const n2 = { additionalData: { username: 'b@example.com' } } as unknown as Notification;
      const result = generateNotifyUserRegisteredContent(n1, n2);
      expect(result).toContain('accounts have');
      expect(result).not.toContain('account has');
    });

    it('calls emailWarning with the expected message', () => {
      const notification = { additionalData: { username: 'user@example.com' } } as unknown as Notification;
      generateNotifyUserRegisteredContent(notification);
      expect(emailWarning).toHaveBeenCalledWith(
        "If this wasn't expected, review the list of contacts in the Transaction Tool."
      );
    });

    it('filters out notifications with missing username', () => {
      const notifications = [
        { additionalData: { username: 'user@example.com' } },
        { additionalData: {} },
        {} as unknown as Notification,
      ] as unknown as Notification[];
      generateNotifyUserRegisteredContent(...notifications);
      // emailUserList is called via emailCardTable — check escapeHtml was only called once for one email
      expect(escapeHtml).toHaveBeenCalledWith('user@example.com');
      expect(escapeHtml).not.toHaveBeenCalledWith(undefined);
    });

    it('filters out null and undefined usernames', () => {
      const notifications = [
        { additionalData: { username: null } },
        { additionalData: { username: undefined } },
        { additionalData: { username: 'valid@example.com' } },
      ] as unknown as Notification[];
      generateNotifyUserRegisteredContent(...notifications);
      expect(escapeHtml).toHaveBeenCalledWith('valid@example.com');
      expect(escapeHtml).not.toHaveBeenCalledWith(null);
    });
  });

// ─── emailUserList ────────────────────────────────────────────────────────────

  describe('emailUserList', () => {
    it('wraps output in a card table', () => {
      const result = emailUserList(['a@example.com']);
      expect(emailCardTable).toHaveBeenCalledTimes(1);
      expect(result).toContain('<TABLE>');
    });

    it('calls emailCardRow for each email', () => {
      emailUserList(['a@example.com', 'b@example.com', 'c@example.com']);
      expect(emailCardRow).toHaveBeenCalledTimes(3);
    });

    it('passes correct row index to emailCardRow', () => {
      emailUserList(['a@example.com', 'b@example.com']);
      expect((emailCardRow as jest.Mock).mock.calls[0][1]).toBe(0);
      expect((emailCardRow as jest.Mock).mock.calls[1][1]).toBe(1);
    });

    it('escapes each email address', () => {
      emailUserList(['<test>@example.com', 'user@example.com']);
      expect(escapeHtml).toHaveBeenCalledWith('<test>@example.com');
      expect(escapeHtml).toHaveBeenCalledWith('user@example.com');
    });

    it('handles empty array', () => {
      const result = emailUserList([]);
      expect(emailCardTable).toHaveBeenCalledWith('');
      expect(result).toContain('<TABLE>');
    });
  });

// ─── userInvitedEmailBody ─────────────────────────────────────────────────────

  describe('userInvitedEmailBody', () => {
    it('includes the organization url', () => {
      const result = userInvitedEmailBody('https://example.com', 'pass123', 'https://download.com');
      expect(result).toContain('https://example.com');
    });

    it('includes the temp password', () => {
      const result = userInvitedEmailBody('https://example.com', 'MyP@ss!', 'https://download.com');
      expect(result).toContain('MyP@ss!');
    });

    it('escapes url and tempPassword', () => {
      userInvitedEmailBody('<url>', '"pass"', 'https://download.com');
      expect(escapeHtml).toHaveBeenCalledWith('<url>');
      expect(escapeHtml).toHaveBeenCalledWith('"pass"');
    });

    it('includes Organization URL label', () => {
      const result = userInvitedEmailBody('https://example.com', 'pass', 'https://download.com');
      expect(result).toContain('Organization URL');
    });

    it('includes Temporary Password label', () => {
      const result = userInvitedEmailBody('https://example.com', 'pass', 'https://download.com');
      expect(result).toContain('Temporary Password');
    });

    it('includes a download button', () => {
      const result = userInvitedEmailBody('https://example.com', 'pass', 'https://download.com');
      expect(result).toContain('https://download.com');
      expect(result).toContain('Download App');
    });

    it('includes getting started links', () => {
      const result = userInvitedEmailBody('https://example.com', 'pass', 'https://download.com');
      expect(result).toContain('Get started');
    });
  });

// ─── emailDownloadButton ──────────────────────────────────────────────────────

  describe('emailDownloadButton', () => {
    it('includes the download url in the href', () => {
      const result = emailDownloadButton('https://download.example.com');
      expect(result).toContain('https://download.example.com');
    });

    it('renders "Download App" label', () => {
      const result = emailDownloadButton('https://download.example.com');
      expect(result).toContain('Download App');
    });

    it('renders an anchor tag', () => {
      const result = emailDownloadButton('https://download.example.com');
      expect(result).toContain('<a ');
      expect(result).toContain('</a>');
    });
  });

// ─── emailGettingStarted ──────────────────────────────────────────────────────

  describe('emailGettingStarted', () => {
    it('includes the "Get started" heading', () => {
      expect(emailGettingStarted()).toContain('Get started');
    });

    it('includes links for key actions', () => {
      const result = emailGettingStarted();
      expect(result).toContain('Hedera Transaction Tool documentation');
      expect(result).toContain('Setting up your account');
      expect(result).toContain('Managing keys');
      expect(result).toContain('Creating and signing a transaction');
      expect(result).toContain('Viewing transaction status and history');
      expect(result).toContain('Managing accounts');
    });

    it('returns a non-empty string', () => {
      expect(emailGettingStarted().length).toBeGreaterThan(0);
    });
  });
});
