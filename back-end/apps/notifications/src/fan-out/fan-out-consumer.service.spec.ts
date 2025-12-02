import { Test, TestingModule } from '@nestjs/testing';
import { FanOutConsumerService } from './fan-out-consumer.service';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';
import { FanOutService } from './fan-out.service';
import {
  FAN_OUT_NEW_NOTIFICATIONS,
  FAN_OUT_DELETE_NOTIFICATIONS,
  FAN_OUT_NOTIFY_CLIENTS,
} from '@app/common';

describe('FanOutConsumerService', () => {
  let service: FanOutConsumerService;
  let fanOutService: jest.Mocked<FanOutService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FanOutConsumerService,
        {
          provide: NatsJetStreamService,
          useValue: {
            getManager: jest.fn(),
            getJetStream: jest.fn(),
          },
        },
        {
          provide: FanOutService,
          useValue: {
            processNewNotifications: jest.fn(),
            processDeleteNotifications: jest.fn(),
            notifyClients: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<FanOutConsumerService>(FanOutConsumerService);
    fanOutService = module.get(FanOutService);
  });

  describe('getConsumerConfig', () => {
    it('should return correct consumer config with unique durable name', () => {
      const config = service['getConsumerConfig']();

      expect(config.streamName).toBe('NOTIFICATIONS_FANOUT');
      expect(config.durableName).toMatch(/^FANOUT_CONSUMER_[a-f0-9-]+$/);
      expect(config.filterSubject).toBe('notifications.fanout.>');
    });

    it('should generate unique consumer names for different instances', () => {
      const service2 = new FanOutConsumerService(
        {} as NatsJetStreamService,
        fanOutService
      );

      const config1 = service['getConsumerConfig']();
      const config2 = service2['getConsumerConfig']();

      expect(config1.durableName).not.toBe(config2.durableName);
    });
  });

  describe('getMessageHandlers', () => {
    it('should return handlers for all fanout subjects', () => {
      const handlers = service['getMessageHandlers']();

      expect(handlers).toHaveLength(3);
      expect(handlers.map(h => h.subject)).toEqual([
        FAN_OUT_NEW_NOTIFICATIONS,
        FAN_OUT_DELETE_NOTIFICATIONS,
        FAN_OUT_NOTIFY_CLIENTS,
      ]);
    });

    it('should call correct service methods for each subject', async () => {
      const handlers = service['getMessageHandlers']();
      const testData = [{ id: 1 }];

      await handlers[0].handler(testData);
      expect(fanOutService.processNewNotifications).toHaveBeenCalledWith(testData);

      await handlers[1].handler(testData);
      expect(fanOutService.processDeleteNotifications).toHaveBeenCalledWith(testData);

      await handlers[2].handler(testData);
      expect(fanOutService.notifyClients).toHaveBeenCalledWith(testData);
    });
  });
});