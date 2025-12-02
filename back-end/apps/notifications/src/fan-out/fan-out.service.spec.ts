// typescript
import { Test, TestingModule } from '@nestjs/testing';
import { FanOutService } from './fan-out.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NOTIFICATIONS_NEW, NOTIFICATIONS_INDICATORS_DELETE, TRANSACTION_ACTION } from '@app/common';

describe('FanOutService', () => {
  let service: FanOutService;
  const websocketMock = {
    notifyUser: jest.fn().mockResolvedValue(undefined),
    notifyClient: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FanOutService,
        { provide: WebsocketGateway, useValue: websocketMock },
      ],
    }).compile();

    service = module.get<FanOutService>(FanOutService);
  });

  it('processNewNotifications should convert receivers and call websocket.notifyUser per dto', async () => {
    const dtos: any[] = [
      {
        userId: 123,
        notificationReceivers: [
          { id: 1, userId: 1, notificationId: 99, isRead: false, extra: 'x' },
        ],
      },
      {
        userId: 456,
        notificationReceivers: [
          { id: 2, userId: 2, notificationId: 100, isRead: true },
          { id: 3, userId: 3, notificationId: 101, isRead: false },
        ],
      },
    ];

    await service.processNewNotifications(dtos);

    expect((websocketMock.notifyUser as jest.Mock).mock.calls.length).toBe(2);
    expect(websocketMock.notifyUser).toHaveBeenCalledWith(123, NOTIFICATIONS_NEW, expect.any(Array));
    expect(websocketMock.notifyUser).toHaveBeenCalledWith(456, NOTIFICATIONS_NEW, expect.any(Array));

    const firstCallReceivers = (websocketMock.notifyUser as jest.Mock).mock.calls[0][2];
    expect(Array.isArray(firstCallReceivers)).toBe(true);
    expect(firstCallReceivers.length).toBe(1);
    // Only assert on properties that survive plainToInstance/excludeExtraneousValues
    expect(firstCallReceivers[0]).toMatchObject({ id: 1 });
  });

  it('processDeleteNotifications should call websocket.notifyUser with indicator delete payload', async () => {
    const deleteDtos: any[] = [
      { userId: 55, notificationReceiverIds: [10, 11] },
      { userId: 66, notificationReceiverIds: [20] },
    ];

    await service.processDeleteNotifications(deleteDtos);

    expect((websocketMock.notifyUser as jest.Mock).mock.calls.length).toBe(2);
    expect(websocketMock.notifyUser).toHaveBeenCalledWith(
      55,
      NOTIFICATIONS_INDICATORS_DELETE,
      { notificationReceiverIds: [10, 11] },
    );
    expect(websocketMock.notifyUser).toHaveBeenCalledWith(
      66,
      NOTIFICATIONS_INDICATORS_DELETE,
      { notificationReceiverIds: [20] },
    );
  });

  it('notifyClients should log and call websocket.notifyClient with TRANSACTION_ACTION', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const dtos: any[] = [{}, {}];

    await service.notifyClients(dtos);

    expect(consoleSpy).toHaveBeenCalledWith('Notify clients called in fan-out service');
    expect(websocketMock.notifyClient).toHaveBeenCalledWith({
      message: TRANSACTION_ACTION,
      content: '',
    });

    consoleSpy.mockRestore();
  });
});
