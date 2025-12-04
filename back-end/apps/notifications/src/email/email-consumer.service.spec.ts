import { Test, TestingModule } from '@nestjs/testing';
import { EmailConsumerService } from './email-consumer.service';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';
import { EmailService } from './email.service';
import { EMAIL_NOTIFICATIONS, USER_INVITE, USER_PASSWORD_RESET } from '@app/common';

describe('EmailConsumerService', () => {
  let service: EmailConsumerService;
  let emailService: jest.Mocked<EmailService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailConsumerService,
        {
          provide: NatsJetStreamService,
          useValue: {
            getManager: jest.fn(),
            getJetStream: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            processUserInviteNotifications: jest.fn(),
            processUserPasswordResetNotifications: jest.fn(),
            processEmails: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailConsumerService>(EmailConsumerService);
    emailService = module.get(EmailService);
  });

  describe('getConsumerConfig', () => {
    it('should return correct consumer config', () => {
      const config = service['getConsumerConfig']();

      expect(config).toEqual({
        streamName: 'NOTIFICATIONS_QUEUE',
        durableName: 'email_queue_worker',
        filterSubjects: [
          'notifications.queue.email',
          'notifications.queue.email.>',
        ],
      });
    });
  });

  describe('getMessageHandlers', () => {
    it('should return handlers for all email subjects', () => {
      const handlers = service['getMessageHandlers']();

      expect(handlers).toHaveLength(3);
      expect(handlers.map(h => h.subject)).toEqual([
        USER_INVITE,
        USER_PASSWORD_RESET,
        EMAIL_NOTIFICATIONS,
      ]);
    });

    it('should call processUserInviteNotifications for USER_INVITE', async () => {
      const handlers = service['getMessageHandlers']();
      const handler = handlers.find(h => h.subject === USER_INVITE);
      const testData = [{ email: 'test@example.com' }];

      await handler.handler(testData);

      expect(emailService.processUserInviteNotifications).toHaveBeenCalledWith(testData);
    });

    it('should call processUserPasswordResetNotifications for USER_PASSWORD_RESET', async () => {
      const handlers = service['getMessageHandlers']();
      const handler = handlers.find(h => h.subject === USER_PASSWORD_RESET);
      const testData = [{ email: 'test@example.com' }];

      await handler.handler(testData);

      expect(emailService.processUserPasswordResetNotifications).toHaveBeenCalledWith(testData);
    });

    it('should call processEmails for EMAIL_NOTIFICATIONS with array', async () => {
      const handlers = service['getMessageHandlers']();
      const handler = handlers.find(h => h.subject === EMAIL_NOTIFICATIONS);
      const testData = [{ id: 1 }, { id: 2 }];

      await handler.handler(testData);

      expect(emailService.processEmails).toHaveBeenCalledWith(testData);
    });

    it('should call processEmails for EMAIL_NOTIFICATIONS with single object', async () => {
      const handlers = service['getMessageHandlers']();
      const handler = handlers.find(h => h.subject === EMAIL_NOTIFICATIONS);
      const testData = { id: 1 };

      await handler.handler(testData);

      expect(emailService.processEmails).toHaveBeenCalledWith([testData]);
    });
  });
});