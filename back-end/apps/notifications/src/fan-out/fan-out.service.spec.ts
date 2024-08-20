import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { NotificationTypeEmailSubjects } from '@app/common';
import {
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  NotificationType,
  User,
  UserStatus,
} from '@entities';

import { FanOutService } from './fan-out.service';

import { EmailService } from '../email/email.service';

describe('Fan Out Service', () => {
  let service: FanOutService;
  const entityManager = mockDeep<EntityManager>();
  const emailService = mockDeep<EmailService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FanOutService,
        {
          provide: EntityManager,
          useValue: entityManager,
        },
        {
          provide: EmailService,
          useValue: emailService,
        },
      ],
    }).compile();

    service = module.get<FanOutService>(FanOutService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  const notification: Notification = {
    id: 1,
    type: NotificationType.TRANSCATION_EXECUTED,
    actorId: null,
    content: '',
    createdAt: new Date(),
    notificationReceivers: [],
  };

  const user: User = {
    id: 1,
    email: 'test@test.com',
    password: 'hash',
    admin: false,
    status: UserStatus.NONE,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    keys: [],
    signerForTransactions: [],
    observableTransactions: [],
    approvableTransactions: [],
    comments: [],
    issuedNotifications: [],
    receivedNotifications: [],
    notificationPreferences: [],
  };

  const receivers: NotificationReceiver[] = [
    {
      id: 1,
      notificationId: 1,
      userId: 1,
      isRead: false,
      updatedAt: new Date(),
      notification,
      user: { ...user },
    },
  ];

  describe('fanOut', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should do nothing if there are no receivers', async () => {
      const receivers: NotificationReceiver[] = [];

      await service.fanOut(notification, receivers);
      await service.fanOut(notification, undefined);
      await service.fanOut(notification, null);
      await service.fanOut(null, null);

      expect(entityManager.find).not.toHaveBeenCalled();
    });

    it('should categorize receivers based on preferences', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: true, inApp: false, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.fanOut(notification, receivers);

      expect(emailService.processEmail).toHaveBeenCalledWith(
        {
          from: '"Transaction Tool" info@transactiontool.com',
          to: [receivers[0].user.email],
          subject: NotificationTypeEmailSubjects.TRANSCATION_EXECUTED,
          text: notification.content,
        },
        [receivers[0].id],
      );
      expect(consoleSpy).not.toHaveBeenCalledWith('In-app receivers', []);
    });

    it('should add user to receivers if preference is not found', async () => {
      const preferences: NotificationPreferences[] = [];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.fanOut(notification, receivers);

      expect(emailService.processEmail).toHaveBeenCalledWith(
        {
          from: '"Transaction Tool" info@transactiontool.com',
          to: [receivers[0].user.email],
          subject: NotificationTypeEmailSubjects.TRANSCATION_EXECUTED,
          text: notification.content,
        },
        [receivers[0].id],
      );
      expect(consoleSpy).toHaveBeenCalledWith('In-app receivers', [receivers[0].userId]);
    });

    it('should filter out receivers that do not want email notifications', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: false, inApp: true, user, type: notification.type },
      ];

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      await service.fanOut(notification, receivers);

      expect(emailService.processEmail).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('In-app receivers', [receivers[0].userId]);
    });

    it('should filter out receivers that do not want in-app notifications', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: true, inApp: false, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      await service.fanOut(notification, receivers);

      expect(emailService.processEmail).toHaveBeenCalledWith(
        {
          from: '"Transaction Tool" info@transactiontool.com',
          to: [receivers[0].user.email],
          subject: NotificationTypeEmailSubjects.TRANSCATION_EXECUTED,
          text: notification.content,
        },
        [receivers[0].id],
      );
    });
  });
});
