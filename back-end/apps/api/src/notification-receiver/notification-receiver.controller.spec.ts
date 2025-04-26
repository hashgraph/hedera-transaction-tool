import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService, Pagination, PaginatedResourceDto, guardMock } from '@app/common';
import { NotificationReceiver, NotificationType, User } from '@entities';

import { JwtAuthGuard, VerifiedUserGuard } from '../guards';

import { UpdateNotificationReceiverDto } from './dtos';

import { NotificationsController } from './notification-receiver.controller';
import { NotificationReceiverService } from './notification-receiver.service';

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: NotificationReceiverService;
  const user: User = { id: 1 } as User;
  const notificationReceiver: NotificationReceiver = {
    id: 1,
    userId: user.id,
    isRead: false,
    notification: {
      actor: {},
      type: NotificationType.TRANSACTION_CREATED,
      content: 'this-is-content',
    },
  } as NotificationReceiver;

  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        {
          provide: NotificationReceiverService,
          useValue: mockDeep<NotificationReceiverService>(),
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(guardMock())
      .overrideGuard(VerifiedUserGuard)
      .useValue(guardMock())
      .compile();

    controller = module.get<NotificationsController>(NotificationsController);
    service = module.get<NotificationReceiverService>(NotificationReceiverService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getNotifications', () => {
    it('should return paginated notifications', async () => {
      const pagination: Pagination = { page: 1, size: 10, offset: 0, limit: 10 };
      const notifications = [notificationReceiver];
      const paginatedResult: PaginatedResourceDto<NotificationReceiver> = {
        page: pagination.page,
        size: pagination.size,
        totalItems: 1,
        items: notifications,
      };

      jest.spyOn(service, 'getReceivedNotifications').mockResolvedValue(paginatedResult);

      const result = await controller.getNotifications(user, pagination);

      expect(service.getReceivedNotifications).toHaveBeenCalledWith(
        user,
        pagination,
        undefined,
        undefined,
      );
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('getNotificationsCount', () => {
    it('should return the count of received notifications', async () => {
      const count = 1;

      jest.spyOn(service, 'getReceivedNotificationsCount').mockResolvedValue(count);

      const result = await controller.getNotificationsCount(user);

      expect(service.getReceivedNotificationsCount).toHaveBeenCalledWith(user, undefined);
      expect(result).toBe(count);
    });
  });

  describe('getReceivedNotification', () => {
    it('should return a notification receiver', async () => {
      jest.spyOn(service, 'getReceivedNotification').mockResolvedValue(notificationReceiver);

      const result = await controller.getReceivedNotification(user, 1);

      expect(service.getReceivedNotification).toHaveBeenCalledWith(user, 1);
      expect(result).toEqual(notificationReceiver);
    });

    it('should throw NotFoundException if notification receiver not found', async () => {
      jest.spyOn(service, 'getReceivedNotification').mockRejectedValue(new NotFoundException());

      await expect(controller.getReceivedNotification(user, 1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateReceivedNotifications', () => {
    it('should update the notification receiver', async () => {
      const dto: UpdateNotificationReceiverDto = { id: 1, isRead: true };
      const updatedNotificationReceivers = [{ ...notificationReceiver, isRead: true }];

      jest
        .spyOn(service, 'updateReceivedNotifications')
        .mockResolvedValue(updatedNotificationReceivers);

      const result = await controller.updateReceivedNotifications(user, [dto]);

      expect(service.updateReceivedNotifications).toHaveBeenCalledWith(user, [dto]);
      expect(result).toEqual(updatedNotificationReceivers);
    });

    it('should throw NotFoundException if notification receiver not found', async () => {
      const dto: UpdateNotificationReceiverDto = { id: 1, isRead: true };

      jest.spyOn(service, 'updateReceivedNotifications').mockRejectedValue(new NotFoundException());

      await expect(controller.updateReceivedNotifications(user, [dto])).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deleteReceivedNotification', () => {
    it('should delete the notification receiver', async () => {
      jest.spyOn(service, 'deleteReceivedNotification').mockResolvedValue(true);

      const result = await controller.deleteReceivedNotification(user, 1);

      expect(service.deleteReceivedNotification).toHaveBeenCalledWith(user, 1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if notification receiver not found', async () => {
      jest.spyOn(service, 'deleteReceivedNotification').mockRejectedValue(new NotFoundException());

      await expect(controller.deleteReceivedNotification(user, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remindSigners', () => {
    it('should remind signers', async () => {
      const transactionId = 1;

      await controller.remindSigners(user, transactionId);

      expect(service.remindSigners).toHaveBeenCalledWith(user, transactionId);
    });
  });
});
