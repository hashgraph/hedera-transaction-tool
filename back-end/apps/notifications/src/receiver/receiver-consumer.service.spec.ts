import { Test, TestingModule } from '@nestjs/testing';
import { ReceiverConsumerService } from './receiver-consumer.service';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';
import { ReceiverService } from './receiver.service';
import {
  TRANSACTION_STATUS_UPDATE,
  TRANSACTION_UPDATE,
  TRANSACTION_REMIND_SIGNERS,
  TRANSACTION_REMIND_SIGNERS_MANUAL,
  USER_REGISTERED, DISMISSED_NOTIFICATIONS,
} from '@app/common';

describe('ReceiverConsumerService', () => {
  let service: ReceiverConsumerService;
  let receiverService: jest.Mocked<ReceiverService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceiverConsumerService,
        {
          provide: NatsJetStreamService,
          useValue: {
            getManager: jest.fn(),
            getJetStream: jest.fn(),
          },
        },
        {
          provide: ReceiverService,
          useValue: {
            processTransactionStatusUpdateNotifications: jest.fn(),
            processTransactionUpdateNotifications: jest.fn(),
            remindSigners: jest.fn(),
            remindSignersManual: jest.fn(),
            processUserRegisteredNotifications: jest.fn(),
            processDismissedNotifications: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReceiverConsumerService>(ReceiverConsumerService);
    receiverService = module.get(ReceiverService);
  });

  describe('getConsumerConfig', () => {
    it('should return correct consumer config with multiple filter subjects', () => {
      const config = service['getConsumerConfig']();

      expect(config).toEqual({
        streamName: 'NOTIFICATIONS_QUEUE',
        durableName: 'receiver_queue_worker',
        filterSubjects: [
          'notifications.queue.user.>',
          'notifications.queue.transaction.>',
          'notifications.queue.notification.>',
        ],
      });
    });
  });

  describe('getMessageHandlers', () => {
    it('should return handlers for all receiver subjects', () => {
      const handlers = service['getMessageHandlers']();

      expect(handlers).toHaveLength(6);
      expect(handlers.map(h => h.subject)).toEqual([
        TRANSACTION_STATUS_UPDATE,
        TRANSACTION_UPDATE,
        TRANSACTION_REMIND_SIGNERS,
        TRANSACTION_REMIND_SIGNERS_MANUAL,
        USER_REGISTERED,
        DISMISSED_NOTIFICATIONS,
      ]);
    });

    it('should call correct service methods for each subject', async () => {
      const handlers = service['getMessageHandlers']();
      const testData = [{ id: 1 }];

      await handlers[0].handler(testData);
      expect(receiverService.processTransactionStatusUpdateNotifications).toHaveBeenCalledWith(testData);

      await handlers[1].handler(testData);
      expect(receiverService.processTransactionUpdateNotifications).toHaveBeenCalledWith(testData);

      await handlers[2].handler(testData);
      expect(receiverService.remindSigners).toHaveBeenCalledWith(testData);

      await handlers[3].handler(testData);
      expect(receiverService.remindSignersManual).toHaveBeenCalledWith(testData);

      const singleData = { id: 1 };
      await handlers[4].handler(singleData);
      expect(receiverService.processUserRegisteredNotifications).toHaveBeenCalledWith(singleData);

      const dismissedData = [{ id: 1, userId: 1 }];
      await handlers[5].handler(dismissedData);
      expect(receiverService.processDismissedNotifications).toHaveBeenCalledWith(dismissedData);
    });
  });
});