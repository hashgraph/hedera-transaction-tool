import { generateUserRegisteredMessage, generateNotifyUserRegisteredContent } from '.';
import { Notification } from '@entities';

describe('generateUserRegisteredMessage', () => {
  it('should generate message with URL and temporary password', () => {
    const additionalData = {
      url: 'https://example.com',
      tempPassword: 'TempPass123',
    };

    const result = generateUserRegisteredMessage(additionalData);

    expect(result).toContain('You have been registered in Hedera Transaction Tool.');
    expect(result).toContain('<b>https://example.com</b>');
    expect(result).toContain('<b>TempPass123</b>');
  });

  it('should include organization URL label', () => {
    const additionalData = {
      url: 'https://example.com',
      tempPassword: 'TempPass123',
    };

    const result = generateUserRegisteredMessage(additionalData);

    expect(result).toContain('The Organization URL is:');
  });

  it('should include temporary password label', () => {
    const additionalData = {
      url: 'https://example.com',
      tempPassword: 'TempPass123',
    };

    const result = generateUserRegisteredMessage(additionalData);

    expect(result).toContain('Your temporary password is:');
  });

  it('should handle different URL formats', () => {
    const testCases = [
      'https://example.com',
      'http://localhost:3000',
      'https://app.example.com/path',
    ];

    testCases.forEach(url => {
      const result = generateUserRegisteredMessage({ url, tempPassword: 'pass' });
      expect(result).toContain(`<b>${url}</b>`);
    });
  });

  it('should handle different password formats', () => {
    const testCases = [
      'Simple123',
      'C0mpl3x!P@ssw0rd',
      'temp-pass-456',
    ];

    testCases.forEach(tempPassword => {
      const result = generateUserRegisteredMessage({ url: 'https://example.com', tempPassword });
      expect(result).toContain(`<b>${tempPassword}</b>`);
    });
  });

  it('should handle undefined values', () => {
    const additionalData = {
      url: undefined,
      tempPassword: undefined,
    };

    const result = generateUserRegisteredMessage(additionalData);

    expect(result).toContain('<b>undefined</b>');
  });
});

describe('generateNotifyUserRegisteredContent', () => {
  describe('single user registration', () => {
    it('should use singular title for one user', () => {
      const notifications = [
        {
          additionalData: {
            username: 'user1@example.com',
          },
        },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('<title>New user registration</title>');
      expect(result).toContain('<h1 style="margin:0;font-size:20px;">New user registration</h1>');
    });

    it('should show user email in intro text', () => {
      const notifications = [
        {
          additionalData: {
            username: 'user1@example.com',
          },
        },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('A user user1@example.com has successfully registered.');
    });

    it('should not include list for single user', () => {
      const notifications = [
        {
          additionalData: {
            username: 'user1@example.com',
          },
        },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).not.toContain('<ul');
      expect(result).not.toContain('<li');
    });
  });

  describe('multiple user registrations', () => {
    it('should use plural title for multiple users', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
        { additionalData: { username: 'user2@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('<title>New user registrations</title>');
      expect(result).toContain('<h1 style="margin:0;font-size:20px;">New user registrations</h1>');
    });

    it('should show plural intro text', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
        { additionalData: { username: 'user2@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('The following users have successfully registered:');
    });

    it('should include list of all users', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
        { additionalData: { username: 'user2@example.com' } },
        { additionalData: { username: 'user3@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('<ul style="margin:8px 0 0 18px;padding:0;">');
      expect(result).toContain('user1@example.com</li>');
      expect(result).toContain('user2@example.com</li>');
      expect(result).toContain('user3@example.com</li>');
    });

    it('should format list items with correct styling', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
        { additionalData: { username: 'user2@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('<li style="margin:4px 0;font-size:14px;color:#333333;">user1@example.com</li>');
      expect(result).toContain('<li style="margin:4px 0;font-size:14px;color:#333333;">user2@example.com</li>');
    });
  });

  describe('email filtering', () => {
    it('should filter out notifications without username', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
        { additionalData: {} },
        { additionalData: { username: 'user2@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('user1@example.com');
      expect(result).toContain('user2@example.com');
      // Should still be plural since we have 2 valid emails
      expect(result).toContain('New user registrations');
    });

    it('should filter out null usernames', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
        { additionalData: { username: null } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('user1@example.com');
      expect(result).toContain('New user registration'); // Singular
    });

    it('should filter out undefined usernames', () => {
      const notifications = [
        { additionalData: { username: undefined } },
        { additionalData: { username: 'user1@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('user1@example.com');
      expect(result).toContain('New user registration'); // Singular
    });

    it('should handle notifications with missing additionalData', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
        {} as unknown as Notification,
        { additionalData: { username: 'user2@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('user1@example.com');
      expect(result).toContain('user2@example.com');
    });
  });

  describe('HTML structure', () => {
    it('should generate valid HTML document', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('<!DOCTYPE html>');
      expect(result).toContain('<html lang="en">');
      expect(result).toContain('</html>');
      expect(result).toContain('<head>');
      expect(result).toContain('</head>');
      expect(result).toContain('<body');
      expect(result).toContain('</body>');
    });

    it('should include meta charset', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('<meta charset="UTF-8" />');
    });

    it('should use table-based layout', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('<table role="presentation"');
      expect(result).toContain('width="600"');
    });

    it('should include header section with brand color', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('background-color:#0b6efd');
      expect(result).toContain('color:#ffffff');
    });

    it('should include footer with automated message disclaimer', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('This is an automated message. Please do not reply.');
    });

    it('should have proper responsive styling', () => {
      const notifications = [
        { additionalData: { username: 'user1@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('background-color:#f5f5f5');
      expect(result).toContain('border-radius:8px');
      expect(result).toContain('padding:24px');
    });
  });

  describe('edge cases', () => {
    it('should handle empty notifications array', () => {
      const notifications: Notification[] = [];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toBeNull();
    });

    it('should handle all notifications without usernames', () => {
      const notifications = [
        { additionalData: {} },
        { additionalData: { username: null } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      // Should still generate valid HTML
      expect(result).toContain('<!DOCTYPE html>');
      expect(result).not.toContain('<li');
    });

    it('should handle special characters in email addresses', () => {
      const notifications = [
        { additionalData: { username: 'user+tag@example.com' } },
        { additionalData: { username: 'user.name@sub.example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      expect(result).toContain('user+tag@example.com');
      expect(result).toContain('user.name@sub.example.com');
    });

    it('should maintain order of users', () => {
      const notifications = [
        { additionalData: { username: 'alice@example.com' } },
        { additionalData: { username: 'bob@example.com' } },
        { additionalData: { username: 'charlie@example.com' } },
      ] as unknown as Notification[];

      const result = generateNotifyUserRegisteredContent(notifications);

      const aliceIndex = result.indexOf('alice@example.com');
      const bobIndex = result.indexOf('bob@example.com');
      const charlieIndex = result.indexOf('charlie@example.com');

      expect(aliceIndex).toBeLessThan(bobIndex);
      expect(bobIndex).toBeLessThan(charlieIndex);
    });
  });
});