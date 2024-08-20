import { Test, TestingModule } from '@nestjs/testing';

import { NOTIFICATIONS_NEW } from '@app/common';
import { Notification, NotificationType } from '@entities';

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
    const notification: Notification = {
      id: 1,
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      content: `A new transaction requires your review and signature.`,
      entityId: 2,
      actorId: null,
      createdAt: new Date(),
      notificationReceivers: [],
    };

    service.processNotification(notification, [1, 2]);

    expect(websocketGateway.notifyUser).toHaveBeenCalledTimes(2);
    expect(websocketGateway.notifyUser).toHaveBeenCalledWith(
      1,
      NOTIFICATIONS_NEW,
      expect.any(Object),
    );
    expect(websocketGateway.notifyUser).toHaveBeenCalledWith(
      2,
      NOTIFICATIONS_NEW,
      expect.any(Object),
    );
  });
});
