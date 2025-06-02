import { Test, TestingModule } from '@nestjs/testing';

import { NOTIFICATIONS_INDICATORS_DELETE, NOTIFICATIONS_NEW } from '@app/common';
import { Notification, NotificationReceiver, NotificationType, User, UserStatus } from '@entities';

import { InAppProcessorService } from './in-app-processor.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { mockDeep } from 'jest-mock-extended';

describe('In App Processor Service', () => {
  let service: InAppProcessorService;
  const websocketGateway = mockDeep<WebsocketGateway>();

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InAppProcessorService,
        {
          provide: WebsocketGateway,
          useValue: websocketGateway,
        },
      ],
    }).compile();

    service = module.get<InAppProcessorService>(InAppProcessorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processNewNotification', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should process in-app notification with network as additional data', async () => {
      const now = new Date();

      const notification: Notification = {
        id: 1,
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        entityId: 2,
        actorId: null,
        createdAt: now,
        notificationReceivers: [],
        additionalData: { network: 'testnet' },
      };

      const user: User = {
        id: 1,
        email: 'test@test.com',
        password: 'hash',
        admin: false,
        status: UserStatus.NONE,
        createdAt: now,
        updatedAt: now,
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
          userId: 1,
          notificationId: notification.id,
          isRead: false,
          isEmailSent: false,
          isInAppNotified: false,
          notification,
          user,
          updatedAt: now,
        },
        {
          id: 2,
          userId: 2,
          notificationId: notification.id,
          isRead: false,
          isEmailSent: false,
          isInAppNotified: false,
          notification,
          user,
          updatedAt: now,
        },
      ];

      service.processNewNotification(notification, receivers);

      expect(websocketGateway.notifyUser).toHaveBeenCalledTimes(2);
      expect(websocketGateway.notifyUser).toHaveBeenCalledWith(1, NOTIFICATIONS_NEW, {
        id: 1,
        notification: {
          id: 1,
          type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
          entityId: 2,
          actorId: null,
          createdAt: now,
          additionalData: { network: 'testnet' },
        },
        notificationId: notification.id,
      });
      expect(websocketGateway.notifyUser).toHaveBeenCalledWith(2, NOTIFICATIONS_NEW, {
        id: 2,
        notification: {
          id: 1,
          type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
          entityId: 2,
          actorId: null,
          createdAt: now,
          additionalData: { network: 'testnet' },
        },
        notificationId: notification.id,
      });
    });

    it('should not process in-app notification if there are no receivers', async () => {
      const notification: Notification = {
        id: 1,
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        entityId: 2,
        actorId: null,
        createdAt: new Date(),
        notificationReceivers: [],
      };

      service.processNewNotification(notification, []);

      expect(websocketGateway.notifyUser).not.toHaveBeenCalled();
    });
  });

  describe('processNotificationDelete', () => {
    beforeEach(() => {
      jest.resetAllMocks();
    });

    it('should process notification delete', async () => {
      const userIdToNotificationReceiversId = {
        1: [1, 2],
        2: [3, 4],
      };

      service.processNotificationDelete(userIdToNotificationReceiversId);

      expect(websocketGateway.notifyUser).toHaveBeenCalledTimes(2);
      expect(websocketGateway.notifyUser).toHaveBeenCalledWith(1, NOTIFICATIONS_INDICATORS_DELETE, {
        notificationReceiverIds: [1, 2],
      });
      expect(websocketGateway.notifyUser).toHaveBeenCalledWith(2, NOTIFICATIONS_INDICATORS_DELETE, {
        notificationReceiverIds: [3, 4],
      });
    });
  });
});
