import { Test, TestingModule } from '@nestjs/testing';

import { NOTIFICATIONS_NEW } from '@app/common';
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

  it('should process in-app notification', async () => {
    const now = new Date();

    const notification: Notification = {
      id: 1,
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      content: `A new transaction requires your review and signature.`,
      entityId: 2,
      actorId: null,
      createdAt: now,
      notificationReceivers: [],
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

    service.processNotification(notification, receivers);

    expect(websocketGateway.notifyUser).toHaveBeenCalledTimes(2);
    expect(websocketGateway.notifyUser).toHaveBeenCalledWith(1, NOTIFICATIONS_NEW, {
      id: 1,
      notification: {
        id: 1,
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        content: `A new transaction requires your review and signature.`,
        entityId: 2,
        actorId: null,
        createdAt: now,
      },
      notificationId: notification.id,
    });
    expect(websocketGateway.notifyUser).toHaveBeenCalledWith(2, NOTIFICATIONS_NEW, {
      id: 2,
      notification: {
        id: 1,
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
        content: `A new transaction requires your review and signature.`,
        entityId: 2,
        actorId: null,
        createdAt: now,
      },
      notificationId: notification.id,
    });
  });

  it('should not process in-app notification if there are no receivers', async () => {
    const notification: Notification = {
      id: 1,
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      content: `A new transaction requires your review and signature.`,
      entityId: 2,
      actorId: null,
      createdAt: new Date(),
      notificationReceivers: [],
    };

    service.processNotification(notification, []);

    expect(websocketGateway.notifyUser).not.toHaveBeenCalled();
  });
});
