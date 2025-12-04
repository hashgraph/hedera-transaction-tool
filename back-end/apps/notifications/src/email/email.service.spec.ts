import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import SMTPTransport from 'nodemailer/lib/smtp-transport';
import { mockDeep } from 'jest-mock-extended';

import {
  generateEmailContent,
  generateResetPasswordMessage,
  generateUserRegisteredMessage,
  NotificationTypeEmailSubjects,
} from '@app/common';

import { EmailService } from './email.service';
import { Notification, NotificationType } from '@entities';

jest.mock('nodemailer');
jest.mock('@app/common', () => ({
  generateEmailContent: jest.fn(),
  generateUserRegisteredMessage: jest.fn(),
  generateResetPasswordMessage: jest.fn(),
  NotificationTypeEmailSubjects: {
    TRANSACTION_CREATED: 'Transaction Created',
    TRANSACTION_WAITING_FOR_SIGNATURES: 'Transaction Waiting Signatures',
    TRANSACTION_EXECUTED: 'Transaction Executed',
  },
}));

describe('EmailService', () => {
  let service: EmailService;
  const transport = {
    sendMail: jest.fn(),
  };

  const configService = mockDeep<ConfigService>();

  beforeEach(async () => {
    jest.resetAllMocks();

    configService.getOrThrow.mockImplementation((key: string) => {
      const config: Record<string, any> = {
        EMAIL_API_HOST: 'smtp.example.com',
        EMAIL_API_PORT: 587,
        EMAIL_API_SECURE: false,
        SENDER_EMAIL: 'noreply@example.com',
        REDIS_URL: 'redis://localhost:6379',
      };
      return config[key];
    });

    configService.get.mockImplementation((key: string) => {
      const config: Record<string, any> = {
        EMAIL_API_USERNAME: 'testuser',
        EMAIL_API_PASSWORD: 'testpass',
        REDIS_URL: 'redis://localhost:6379',
      };
      return config[key];
    });

    jest
      .mocked(createTransport)
      .mockReturnValue(transport as unknown as Transporter<SMTPTransport.SentMessageInfo>);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);

    // Mock the batcher to prevent actual Redis connections
    (service as any).batcher = {
      add: jest.fn().mockResolvedValue(undefined),
    };
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('constructor and configuration', () => {
    it('should create transporter with correct config including auth', () => {
      expect(createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: {
          user: 'testuser',
          pass: 'testpass',
        },
      });
    });

    it('should create transporter without auth if credentials not provided', async () => {
      jest.clearAllMocks();

      // Mock getOrThrow to return required config values
      configService.getOrThrow.mockImplementation((key: string) => {
        const config: Record<string, any> = {
          EMAIL_API_HOST: 'smtp.example.com',
          EMAIL_API_PORT: 587,
          EMAIL_API_SECURE: false,
          SENDER_EMAIL: 'noreply@example.com',
          REDIS_URL: 'redis://localhost:6379',
        };
        return config[key];
      });

      // Mock get to return undefined for auth credentials
      configService.get.mockReturnValue(undefined);

      const module = await Test.createTestingModule({
        providers: [
          EmailService,
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const serviceInstance = module.get<EmailService>(EmailService);

      expect(createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
      });
    });

    it('should throw error if required config is missing', async () => {
      jest.clearAllMocks();

      configService.getOrThrow.mockImplementation(() => {
        throw new Error('Config value not found');
      });

      await expect(
        Test.createTestingModule({
          providers: [
            EmailService,
            {
              provide: ConfigService,
              useValue: configService,
            },
          ],
        }).compile()
      ).rejects.toThrow('Config value not found');
    });
  });

  describe('processEmails', () => {
    it('should call batcher.add for each notification except TRANSACTION_EXECUTED', async () => {
      const emailNotifications = [
        {
          email: 'user1@example.com',
          notifications: [
            { id: 1, type: NotificationType.TRANSACTION_CREATED } as Notification,
            { id: 2, type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES } as Notification,
          ],
        },
        {
          email: 'user2@example.com',
          notifications: [
            { id: 3, type: NotificationType.TRANSACTION_CREATED } as Notification,
          ],
        },
      ];

      await service.processEmails(emailNotifications);

      const addMock = (service as any).batcher.add;
      expect(addMock).toHaveBeenCalledTimes(3);
      expect(addMock).toHaveBeenCalledWith(
        emailNotifications[0].notifications[0],
        'user1@example.com'
      );
      expect(addMock).toHaveBeenCalledWith(
        emailNotifications[0].notifications[1],
        'user1@example.com'
      );
      expect(addMock).toHaveBeenCalledWith(
        emailNotifications[1].notifications[0],
        'user2@example.com'
      );
    });

    it('should skip TRANSACTION_EXECUTED notifications', async () => {
      const emailNotifications = [
        {
          email: 'user@example.com',
          notifications: [
            { id: 1, type: NotificationType.TRANSACTION_CREATED } as Notification,
            { id: 2, type: NotificationType.TRANSACTION_EXECUTED } as Notification,
            { id: 3, type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES } as Notification,
          ],
        },
      ];

      await service.processEmails(emailNotifications);

      const addMock = (service as any).batcher.add;
      // Should only add 2 (skipping TRANSACTION_EXECUTED)
      expect(addMock).toHaveBeenCalledTimes(2);
      expect(addMock).not.toHaveBeenCalledWith(
        emailNotifications[0].notifications[1],
        'user@example.com'
      );
    });

    it('should handle empty notifications array', async () => {
      const emailNotifications = [
        {
          email: 'user@example.com',
          notifications: [],
        },
      ];

      await service.processEmails(emailNotifications);

      const addMock = (service as any).batcher.add;
      expect(addMock).not.toHaveBeenCalled();
    });

    it('should handle empty email notifications array', async () => {
      await service.processEmails([]);

      const addMock = (service as any).batcher.add;
      expect(addMock).not.toHaveBeenCalled();
    });
  });

  describe('processMessages', () => {
    it('should group notifications by type and send emails', async () => {
      const notifications: Notification[] = [
        {
          id: 1,
          type: NotificationType.TRANSACTION_CREATED,
        } as Notification,
        {
          id: 2,
          type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        } as Notification,
        {
          id: 3,
          type: NotificationType.TRANSACTION_CREATED,
        } as Notification,
      ];

      transport.sendMail.mockResolvedValue({ messageId: 'test-message-1' });
      (generateEmailContent as jest.Mock).mockReturnValue('Email content');

      await (service as any)['processMessages']('user@example.com', notifications);

      // Should send 2 emails (one for each type)
      expect(transport.sendMail).toHaveBeenCalledTimes(2);

      // Verify first call (TRANSACTION_CREATED with 2 notifications)
      expect(transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('Transaction Tool'),
          to: 'user@example.com',
          subject: NotificationTypeEmailSubjects[NotificationType.TRANSACTION_CREATED],
          text: 'Email content',
        })
      );

      // Verify generateEmailContent was called with correct notifications
      expect(generateEmailContent).toHaveBeenCalledWith(
        NotificationType.TRANSACTION_CREATED,
        notifications[0],
        notifications[2]
      );
      expect(generateEmailContent).toHaveBeenCalledWith(
        NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        notifications[1]
      );
    });

    it('should handle single notification type', async () => {
      const notifications: Notification[] = [
        { id: 1, type: NotificationType.TRANSACTION_CREATED } as Notification,
        { id: 2, type: NotificationType.TRANSACTION_CREATED } as Notification,
      ];

      transport.sendMail.mockResolvedValue({ messageId: 'test-message' });
      (generateEmailContent as jest.Mock).mockReturnValue('Content');

      await (service as any)['processMessages']('user@example.com', notifications);

      expect(transport.sendMail).toHaveBeenCalledTimes(1);
      expect(generateEmailContent).toHaveBeenCalledWith(
        NotificationType.TRANSACTION_CREATED,
        notifications[0],
        notifications[1]
      );
    });

    it('should handle empty notifications array', async () => {
      await (service as any)['processMessages']('user@example.com', []);

      expect(transport.sendMail).not.toHaveBeenCalled();
      expect(generateEmailContent).not.toHaveBeenCalled();
    });
  });

  describe('processUserInviteNotifications', () => {
    it('should send invite emails for valid events', async () => {
      const events = [
        { email: 'user1@example.com', additionalData: { name: 'User One', token: 'token1' } },
        { email: 'user2@example.com', additionalData: { name: 'User Two', token: 'token2' } },
      ];

      (generateUserRegisteredMessage as jest.Mock).mockReturnValue('<p>Welcome</p>');
      transport.sendMail.mockResolvedValue({ messageId: 'invite-msg' });

      await service.processUserInviteNotifications(events);

      expect(generateUserRegisteredMessage).toHaveBeenCalledTimes(2);
      expect(transport.sendMail).toHaveBeenCalledTimes(2);
      expect(transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('Transaction Tool'),
          to: 'user1@example.com',
          subject: 'Hedera Transaction Tool Registration',
          html: '<p>Welcome</p>',
          text: 'Welcome', // Plain text without HTML tags
        })
      );
    });

    it('should skip events with missing email', async () => {
      const events = [
        { email: undefined, additionalData: { name: 'User' } },
        { email: 'valid@example.com', additionalData: { name: 'Valid User' } },
      ] as any[];

      (generateUserRegisteredMessage as jest.Mock).mockReturnValue('<p>Welcome</p>');
      transport.sendMail.mockResolvedValue({ messageId: 'msg' });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.processUserInviteNotifications(events);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No email provided')
      );
      expect(transport.sendMail).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should skip events with missing additionalData', async () => {
      const events = [
        { email: 'user@example.com', additionalData: undefined },
        { email: 'valid@example.com', additionalData: { name: 'Valid' } },
      ] as any[];

      (generateUserRegisteredMessage as jest.Mock).mockReturnValue('<p>Welcome</p>');
      transport.sendMail.mockResolvedValue({ messageId: 'msg' });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.processUserInviteNotifications(events);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No payload provided')
      );
      expect(transport.sendMail).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should handle sendMail failures gracefully', async () => {
      const events = [
        { email: 'fail@example.com', additionalData: { name: 'Fail User' } },
        { email: 'success@example.com', additionalData: { name: 'Success User' } },
      ];

      (generateUserRegisteredMessage as jest.Mock).mockReturnValue('<p>Welcome</p>');
      transport.sendMail
        .mockRejectedValueOnce(new Error('SMTP error'))
        .mockResolvedValueOnce({ messageId: 'success-msg' });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.processUserInviteNotifications(events);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send user invite email'),
        expect.any(Error)
      );
      expect(transport.sendMail).toHaveBeenCalledTimes(2);

      errorSpy.mockRestore();
    });

    it('should handle empty events array', async () => {
      await service.processUserInviteNotifications([]);

      expect(generateUserRegisteredMessage).not.toHaveBeenCalled();
      expect(transport.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('processUserPasswordResetNotifications', () => {
    it('should send password reset emails for valid events', async () => {
      const events = [
        { email: 'user1@example.com', additionalData: { token: 'reset-token-1' } },
        { email: 'user2@example.com', additionalData: { token: 'reset-token-2' } },
      ];

      (generateResetPasswordMessage as jest.Mock).mockReturnValue('<p>Reset your password</p>');
      transport.sendMail.mockResolvedValue({ messageId: 'reset-msg' });

      await service.processUserPasswordResetNotifications(events);

      expect(generateResetPasswordMessage).toHaveBeenCalledTimes(2);
      expect(transport.sendMail).toHaveBeenCalledTimes(2);
      expect(transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: expect.stringContaining('Transaction Tool'),
          to: 'user1@example.com',
          subject: 'Password Reset Token',
          html: '<p>Reset your password</p>',
          text: 'Reset your password',
        })
      );
    });

    it('should skip events with missing email and log error', async () => {
      const events = [
        { additionalData: { token: 'token1' } },
        { email: 'valid@example.com', additionalData: { token: 'token2' } },
      ] as any[];

      (generateResetPasswordMessage as jest.Mock).mockReturnValue('<p>Reset</p>');
      transport.sendMail.mockResolvedValue({ messageId: 'msg' });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.processUserPasswordResetNotifications(events);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No email provided in event for password reset')
      );
      expect(transport.sendMail).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should skip events with missing additionalData and log error', async () => {
      const events = [
        { email: 'user@example.com' },
        { email: 'valid@example.com', additionalData: { token: 'token' } },
      ] as any[];

      (generateResetPasswordMessage as jest.Mock).mockReturnValue('<p>Reset</p>');
      transport.sendMail.mockResolvedValue({ messageId: 'msg' });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.processUserPasswordResetNotifications(events);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('No payload provided in event for password reset')
      );
      expect(transport.sendMail).toHaveBeenCalledTimes(1);

      errorSpy.mockRestore();
    });

    it('should handle both send failure and success', async () => {
      const events = [
        { email: 'fail@example.com', additionalData: { token: 'token1' } },
        { email: 'success@example.com', additionalData: { token: 'token2' } },
      ];

      (generateResetPasswordMessage as jest.Mock).mockReturnValue('<p>Reset</p>');
      transport.sendMail
        .mockRejectedValueOnce(new Error('send-failed'))
        .mockResolvedValueOnce({ messageId: 'ok-msg' });

      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.processUserPasswordResetNotifications(events);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send password reset email to fail@example.com'),
        expect.any(Error)
      );
      expect(transport.sendMail).toHaveBeenCalledTimes(2);

      errorSpy.mockRestore();
    });

    it('should handle empty events array', async () => {
      await service.processUserPasswordResetNotifications([]);

      expect(generateResetPasswordMessage).not.toHaveBeenCalled();
      expect(transport.sendMail).not.toHaveBeenCalled();
    });
  });

  describe('sendTransactionalEmails (private method)', () => {
    it('should correctly strip HTML tags for plain text', async () => {
      const events = [
        { email: 'user@example.com', additionalData: { data: 'test' } },
      ];

      const htmlContent = '<p>Hello <strong>World</strong></p>';
      const mockGenerator = jest.fn().mockReturnValue(htmlContent);
      transport.sendMail.mockResolvedValue({ messageId: 'msg' });

      await (service as any)['sendTransactionalEmails'](
        events,
        'Test Subject',
        mockGenerator,
        'test'
      );

      expect(transport.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: 'Hello World', // HTML tags stripped
          html: htmlContent,
        })
      );
    });

    it('should log completion message', async () => {
      const events = [
        { email: 'user1@example.com', additionalData: {} },
        { email: 'user2@example.com', additionalData: {} },
      ];

      const mockGenerator = jest.fn().mockReturnValue('<p>Test</p>');
      transport.sendMail.mockResolvedValue({ messageId: 'msg' });

      const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await (service as any)['sendTransactionalEmails'](
        events,
        'Subject',
        mockGenerator,
        'test type'
      );

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Completed sending 2 test type emails')
      );

      logSpy.mockRestore();
    });
  });
});
// import { Test, TestingModule } from '@nestjs/testing';
// import { ConfigService } from '@nestjs/config';
// import { createTransport, Transporter } from 'nodemailer';
// import SMTPTransport from 'nodemailer/lib/smtp-transport';
// import { mockDeep } from 'jest-mock-extended';
//
// import {
//   generateEmailContent, generateResetPasswordMessage,
//   generateUserRegisteredMessage,
//   NotificationTypeEmailSubjects,
// } from '@app/common';
//
// import { EmailService } from './email.service';
// import { Notification } from '@entities';
//
// jest.mock('nodemailer');
// jest.mock('@app/common', () => ({
//   generateEmailContent: jest.fn(),
//   generateUserRegisteredMessage: jest.fn(),
//   generateResetPasswordMessage: jest.fn(),
//   NotificationTypeEmailSubjects: {
//     TYPE_A: 'Type A Subject',
//     TYPE_B: 'Type B Subject'
//   }
// }));
//
// describe('Email Service', () => {
//   let service: EmailService;
//   const transport = {
//     sendMail: jest.fn(),
//   };
//
//   const configService = mockDeep<ConfigService>();
//
//   beforeEach(async () => {
//     jest.resetAllMocks();
//
//     jest
//       .mocked(createTransport)
//       .mockReturnValue(transport as unknown as Transporter<SMTPTransport.SentMessageInfo>);
//
//     const module: TestingModule = await Test.createTestingModule({
//       providers: [
//         EmailService,
//         {
//           provide: ConfigService,
//           useValue: configService,
//         },
//       ],
//     }).compile();
//
//     service = module.get<EmailService>(EmailService);
//     (service as any).batcher = {
//       add: jest.fn().mockResolvedValue(undefined),
//     };
//   });
//
//   it('should be defined', () => {
//     expect(service).toBeDefined();
//   });
//
//   it('should call batcher.add for each email', async () => {
//     const emails = ['user1@example.com', 'user2@example.com'];
//     const notification = {id: 1, type: 'SOME_TYPE'} as unknown as Notification;
//
//     await service.processEmail(emails, notification);
//
//     const addMock = (service as any).batcher.add;
//     expect(addMock).toHaveBeenCalledTimes(emails.length);
//     emails.forEach(email =>
//       expect(addMock).toHaveBeenCalledWith(notification, email),
//     );
//   });
//
//   it('should group notifications by type and send emails using processMessages', async () => {
//     const notifications: Notification[] = [
//       { id: 1, type: 'TYPE_A' as keyof typeof NotificationTypeEmailSubjects } as unknown as Notification,
//       { id: 2, type: 'TYPE_B' as keyof typeof NotificationTypeEmailSubjects } as unknown as Notification,
//       { id: 3, type: 'TYPE_A' as keyof typeof NotificationTypeEmailSubjects } as unknown as Notification,
//     ];
//     // Set up sendMail mock to resolve.
//     transport.sendMail.mockResolvedValue({ messageId: 'test-message' });
//
//     (generateEmailContent as jest.Mock).mockReturnValue('mocked value');
//
//     await (service as any)['processMessages']('group@mail.com', notifications);
//
//     // Expect two calls: one for each notification type.
//     expect(transport.sendMail).toHaveBeenCalledTimes(2);
//
//     // Optionally, verify parameters for one call.
//     const callOptions = (transport.sendMail as jest.Mock).mock.calls[0][0];
//     expect(callOptions.from).toContain('Transaction Tool');
//     expect(callOptions.to).toEqual('group@mail.com');
//     // The subject and text depend on your implementation.
//     expect(callOptions.subject).toEqual(NotificationTypeEmailSubjects[callOptions.subject as keyof typeof NotificationTypeEmailSubjects] || callOptions.subject);
//     expect(typeof callOptions.text).toBe('string');
//   });
//
//   it('processUserInviteNotifications should call generator and sendMail for valid events', async () => {
//     const events = [
//       { email: 'invitee@example.com', additionalData: { name: 'Invitee' } } as any,
//     ];
//
//     (generateUserRegisteredMessage as jest.Mock).mockReturnValue('<p>Welcome Invitee</p>');
//     transport.sendMail.mockResolvedValueOnce({ messageId: 'invite-msg' });
//
//     await service.processUserInviteNotifications(events);
//
//     expect(generateUserRegisteredMessage).toHaveBeenCalledWith(events[0].additionalData);
//     expect(transport.sendMail).toHaveBeenCalledWith(
//       expect.objectContaining({
//         to: events[0].email,
//         subject: 'Hedera Transaction Tool Registration',
//         html: '<p>Welcome Invitee</p>',
//       }),
//     );
//   });
//
//   it('processUserPasswordResetNotifications should skip invalid events and log send failures', async () => {
//     const events = [
//       // missing email
//       { additionalData: { token: 't1' } } as any,
//       // missing additionalData
//       { email: 'missingpayload@example.com' } as any,
//       // valid but send fails for first, succeeds for second
//       { email: 'fail@example.com', additionalData: { token: 't2' } } as any,
//       { email: 'ok@example.com', additionalData: { token: 't3' } } as any,
//     ];
//
//     (generateResetPasswordMessage as jest.Mock).mockReturnValue('<p>Reset</p>');
//
//     // first valid send fails, second succeeds
//     transport.sendMail
//       .mockRejectedValueOnce(new Error('send-failed'))
//       .mockResolvedValueOnce({ messageId: 'ok-msg' });
//
//     const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
//     await service.processUserPasswordResetNotifications(events);
//
//     // Should have logged missing email and missing payload
//     expect(errorSpy.mock.calls.some(c => typeof c[0] === 'string' && c[0].includes('No email provided'))).toBe(true);
//     expect(errorSpy.mock.calls.some(c => typeof c[0] === 'string' && c[0].includes('No payload provided'))).toBe(true);
//
//     // Should have attempted two sends (for two valid events)
//     expect(transport.sendMail).toHaveBeenCalledTimes(2);
//
//     // Should have logged the failed send
//     expect(errorSpy.mock.calls.some(c => typeof c[0] === 'string' && c[0].includes('Failed to send password reset email'))).toBe(true);
//
//     errorSpy.mockRestore();
//   });
// });