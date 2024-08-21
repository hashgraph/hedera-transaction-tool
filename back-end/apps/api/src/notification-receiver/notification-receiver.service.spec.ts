import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { mockDeep } from 'jest-mock-extended';

import { Filtering, Pagination, Sorting } from '@app/common';
import { NotificationReceiver, User, Notification, NotificationType } from '@entities';

import { NotificationReceiverService } from './notification-receiver.service';

import { UpdateNotificationReceiverDto } from './dtos';

describe('NotificationReceiverService', () => {
  let service: NotificationReceiverService;
  const repo = mockDeep<Repository<NotificationReceiver>>();

  const user: User = { id: 1 } as User;
  const notificationReceiver: NotificationReceiver = {
    id: 1,
    userId: user.id,
    isRead: false,
    notification: {} as Notification,
  } as NotificationReceiver;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationReceiverService,
        {
          provide: getRepositoryToken(NotificationReceiver),
          useValue: repo,
        },
      ],
    }).compile();

    service = module.get<NotificationReceiverService>(NotificationReceiverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getReceivedNotifications', () => {
    it('should return paginated notifications', async () => {
      const pagination: Pagination = { page: 1, size: 10, offset: 0, limit: 10 };
      const notifications = [notificationReceiver];
      repo.findAndCount.mockResolvedValue([notifications, 1]);

      const result = await service.getReceivedNotifications(user, pagination);

      expect(repo.findAndCount).toHaveBeenCalled();
      expect(result).toEqual({
        page: pagination.page,
        size: pagination.size,
        totalItems: 1,
        items: notifications,
      });
    });

    it('should return notifications filtered by type', async () => {
      const pagination: Pagination = { page: 1, size: 10, offset: 0, limit: 10 };
      const notificationReceiver1: NotificationReceiver = {
        id: 1,
        userId: user.id,
        isRead: false,
        notification: {
          type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        },
      } as NotificationReceiver;
      const notifications = [notificationReceiver1];
      repo.findAndCount.mockResolvedValue([notifications, 1]);

      const filter: Filtering[] = [
        {
          property: 'type',
          rule: 'eq',
          value: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
        },
      ];
      const result = await service.getReceivedNotifications(user, pagination, null, filter);

      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: {
          userId: user.id,
          notification: {
            type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
          },
        },
        skip: 0,
        take: 10,
        relations: {
          notification: true,
        },
      });
      expect(result).toEqual({
        page: pagination.page,
        size: pagination.size,
        totalItems: 1,
        items: notifications,
      });
    });
  });

  describe('getReceivedNotificationsCount', () => {
    it('should return the count of received notifications', async () => {
      repo.count.mockResolvedValue(1);

      const result = await service.getReceivedNotificationsCount(user);

      expect(repo.count).toHaveBeenCalled();
      expect(result).toBe(1);
    });
  });

  describe('getReceivedNotification', () => {
    it('should return a notification receiver', async () => {
      repo.findOne.mockResolvedValue(notificationReceiver);

      const result = await service.getReceivedNotification(user, 1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: user.id },
        relations: { notification: true },
      });
      expect(result).toEqual(notificationReceiver);
    });

    it('should throw NotFoundException if notification receiver not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.getReceivedNotification(user, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateReceivedNotification', () => {
    it('should update the notification receiver', async () => {
      const dto: UpdateNotificationReceiverDto = { isRead: true };
      repo.findOne.mockResolvedValue(notificationReceiver);

      const result = await service.updateReceivedNotification(user, 1, dto);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: user.id },
        relations: { notification: true },
      });
      expect(repo.update).toHaveBeenCalledWith({ id: 1 }, { isRead: true });
      expect(result.isRead).toBe(true);
    });

    it('should throw NotFoundException if notification receiver not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.updateReceivedNotification(user, 1, { isRead: true })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteReceivedNotification', () => {
    it('should delete the notification receiver', async () => {
      repo.findOne.mockResolvedValue(notificationReceiver);

      const result = await service.deleteReceivedNotification(user, 1);

      expect(repo.findOne).toHaveBeenCalledWith({
        where: { id: 1, userId: user.id },
        relations: { notification: true },
      });
      expect(repo.delete).toHaveBeenCalledWith({ id: 1 });
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if notification receiver not found', async () => {
      repo.findOne.mockResolvedValue(null);

      await expect(service.deleteReceivedNotification(user, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getFindOptionsForNotifications', () => {
    it('should return find options with filtering and sorting', () => {
      const pagination: Pagination = { limit: 10, offset: 0, page: 1, size: 10 };
      const sort: Sorting[] = [
        { property: 'isRead', direction: 'ASC' },
        { property: 'type', direction: 'DESC' },
      ];
      const filter: Filtering[] = [{ property: 'isRead', rule: 'eq', value: 'true' }];

      const result = service.getFindOptionsForNotifications(user, pagination, sort, filter);

      expect(result).toEqual({
        where: {
          userId: user.id,
          isRead: 'true',
        },
        order: {
          isRead: 'ASC',
          notification: {
            type: 'DESC',
          },
        },
        relations: {
          notification: true,
        },
        skip: 0,
        take: 10,
      });
    });

    it('should return find options without filtering and sorting', () => {
      const pagination: Pagination = { limit: 10, offset: 0, page: 1, size: 10 };

      const result = service.getFindOptionsForNotifications(user, pagination);

      expect(result).toEqual({
        where: {
          userId: user.id,
        },
        relations: {
          notification: true,
        },
        skip: 0,
        take: 10,
      });
    });

    it('should return find options without pagination', () => {
      const result = service.getFindOptionsForNotifications(user);

      expect(result).toEqual({
        where: {
          userId: user.id,
        },
        relations: {
          notification: true,
        },
      });
    });
  });
});
