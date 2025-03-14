import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager, In } from 'typeorm';
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
import { InAppProcessorService } from '../in-app-processor/in-app-processor.service';

describe('Fan Out Service', () => {
  let service: FanOutService;
  const entityManager = mockDeep<EntityManager>();
  const emailService = mockDeep<EmailService>();
  const inAppProcessorService = mockDeep<InAppProcessorService>();

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
        {
          provide: InAppProcessorService,
          useValue: inAppProcessorService,
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
    type: NotificationType.TRANSACTION_EXECUTED,
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

  describe('fanOutNew', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should do nothing if there are no receivers', async () => {
      const receivers: NotificationReceiver[] = [];

      await service.fanOutNew(notification, receivers);
      await service.fanOutNew(notification, undefined);
      await service.fanOutNew(notification, null);
      await service.fanOutNew(null, null);

      expect(entityManager.find).not.toHaveBeenCalled();
    });

    it('should categorize receivers based on preferences', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: true, inApp: false, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      await service.fanOutNew(notification, receivers);

      expect(emailService.processEmail).toHaveBeenCalledWith({
        from: '"Transaction Tool" no-reply@hederatransactiontool.com',
        to: [receivers[0].user.email],
        subject: NotificationTypeEmailSubjects.TRANSACTION_EXECUTED,
        text: notification.content,
      });
      expect(inAppProcessorService.processNewNotification).not.toHaveBeenCalled();
      expect(entityManager.update).toHaveBeenCalledTimes(2); //1 to mark email sent as false, 1 to mark email sent as true
      expect(entityManager.update).toHaveBeenNthCalledWith(
        1,
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].id]),
        },
        {
          isEmailSent: false,
        },
      );
      expect(entityManager.update).toHaveBeenNthCalledWith(
        2,
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].id]),
        },
        {
          isEmailSent: true,
        },
      );
    });

    it('should add user to receivers if preference is not found', async () => {
      const preferences: NotificationPreferences[] = [];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      await service.fanOutNew(notification, receivers);

      expect(emailService.processEmail).toHaveBeenCalledWith({
        from: '"Transaction Tool" no-reply@hederatransactiontool.com',
        to: [receivers[0].user.email],
        subject: NotificationTypeEmailSubjects.TRANSACTION_EXECUTED,
        text: notification.content,
      });
      expect(entityManager.update).toHaveBeenCalledTimes(4);
      expect(entityManager.update).toHaveBeenCalledWith(
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].id]),
        },
        {
          isEmailSent: false,
        },
      );
      expect(entityManager.update).toHaveBeenCalledWith(
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].id]),
        },
        {
          isEmailSent: true,
        },
      );
    });

    it('should filter out receivers that do not want email notifications', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: false, inApp: true, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      await service.fanOutNew(notification, receivers);

      expect(emailService.processEmail).not.toHaveBeenCalled();
      expect(entityManager.update).toHaveBeenCalledTimes(2);
      expect(entityManager.update).toHaveBeenNthCalledWith(
        1,
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].userId]),
        },
        {
          isInAppNotified: false,
        },
      );
    });

    it('should filter out receivers that do not want in-app notifications', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: true, inApp: false, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      await service.fanOutNew(notification, receivers);

      expect(emailService.processEmail).toHaveBeenCalledWith({
        from: '"Transaction Tool" no-reply@hederatransactiontool.com',
        to: [receivers[0].user.email],
        subject: NotificationTypeEmailSubjects.TRANSACTION_EXECUTED,
        text: notification.content,
      });
      expect(entityManager.update).toHaveBeenCalledTimes(2);
      expect(entityManager.update).toHaveBeenNthCalledWith(
        1,
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].id]),
        },
        {
          isEmailSent: false,
        },
      );
      expect(entityManager.update).toHaveBeenNthCalledWith(
        2,
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].id]),
        },
        {
          isEmailSent: true,
        },
      );
    });

    it('should not mark isEmailSent as true if email processing fails', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: true, inApp: false, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);
      emailService.processEmail.mockRejectedValueOnce(new Error('Email failed'));

      await service.fanOutNew(notification, receivers);

      expect(emailService.processEmail).toHaveBeenCalledWith({
        from: '"Transaction Tool" no-reply@hederatransactiontool.com',
        to: [receivers[0].user.email],
        subject: NotificationTypeEmailSubjects.TRANSACTION_EXECUTED,
        text: notification.content,
      });
      expect(entityManager.update).not.toHaveBeenCalledWith(
        NotificationReceiver,
        {
          notificationId: notification.id,
          userId: In([receivers[0].id]),
        },
        {
          isEmailSent: true,
        },
      );
    });

    it('should not mark isInAppNotified as true if in-app processing fails', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: false, inApp: true, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);
      inAppProcessorService.processNewNotification.mockImplementationOnce(() => {
        throw new Error('In-app failed');
      });

      await service.fanOutNew(notification, receivers);

      expect(entityManager.update).not.toHaveBeenCalledWith(
        NotificationReceiver,
        { notificationId: notification.id, userId: In([receivers[0].userId]) },
        { isInAppNotified: true },
      );
    });

    it('should not send email if notification type is in blacklist', async () => {
      const notification: Notification = {
        id: 1,
        type: NotificationType.TRANSACTION_INDICATOR_SIGN,
        actorId: null,
        content: '',
        createdAt: new Date(),
        notificationReceivers: [],
      };

      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: true, inApp: true, user, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce([user]);
      entityManager.find.mockResolvedValueOnce(preferences);

      await service.fanOutNew(notification, receivers);

      expect(emailService.processEmail).not.toHaveBeenCalled();
      expect(inAppProcessorService.processNewNotification).toHaveBeenCalledWith(
        notification,
        receivers,
      );
    });
  });

  describe('fanOutIndicatorsDelete', () => {
    it('should call inAppProcessorService.processNotificationDelete', () => {
      service.fanOutIndicatorsDelete({ 1: [1] });

      expect(inAppProcessorService.processNotificationDelete).toHaveBeenCalledWith({ 1: [1] });
    });
  });
});
