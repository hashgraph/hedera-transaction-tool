import { Test, TestingModule } from '@nestjs/testing';
import { EntityManager } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { FanOutService } from './fan-out.service';
import {
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  NotificationType,
} from '@entities';

describe('Fan Out Service', () => {
  let service: FanOutService;
  const entityManager = mockDeep<EntityManager>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FanOutService,
        {
          provide: EntityManager,
          useValue: entityManager,
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

  const receivers: NotificationReceiver[] = [
    {
      id: 1,
      notificationId: 1,
      userId: 1,
      isRead: false,
      updatedAt: new Date(),
      notification,
      user: null,
    },
  ];

  describe('fanOut', () => {
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
        { id: 1, userId: 1, email: true, inApp: false, user: null, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce(preferences);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.fanOut(notification, receivers);

      expect(consoleSpy).toHaveBeenCalledWith('Email receivers', [receivers[0]]);
      expect(consoleSpy).toHaveBeenCalledWith('In-app receivers', []);
    });

    it('should add user to receivers if preference is not found', async () => {
      const preferences: NotificationPreferences[] = [];

      entityManager.find.mockResolvedValueOnce(preferences);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.fanOut(notification, receivers);

      expect(consoleSpy).toHaveBeenCalledWith('Email receivers', [receivers[0]]);
      expect(consoleSpy).toHaveBeenCalledWith('In-app receivers', [receivers[0]]);
    });

    it('should filter out receivers that do not want email notifications', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: false, inApp: true, user: null, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce(preferences);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.fanOut(notification, receivers);

      expect(consoleSpy).toHaveBeenCalledWith('Email receivers', []);
      expect(consoleSpy).toHaveBeenCalledWith('In-app receivers', [receivers[0]]);
    });

    it('should filter out receivers that do not want in-app notifications', async () => {
      const preferences: NotificationPreferences[] = [
        { id: 1, userId: 1, email: true, inApp: false, user: null, type: notification.type },
      ];

      entityManager.find.mockResolvedValueOnce(preferences);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await service.fanOut(notification, receivers);

      expect(consoleSpy).toHaveBeenCalledWith('Email receivers', [receivers[0]]);
      expect(consoleSpy).toHaveBeenCalledWith('In-app receivers', []);
    });
  });
});
