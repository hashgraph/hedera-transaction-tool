import { Test, TestingModule } from '@nestjs/testing';
import {
  BaseNatsConsumerService,
  ConsumerConfig,
  MessageHandler,
} from './base-nats-consumer.service';
import { NatsJetStreamService } from '@app/common/nats/nats-jetstream.service';
import { AckPolicy, DeliverPolicy } from 'nats';
import { MessageValidator } from './message-validator.util';

jest.mock('./message-validator.util');

class TestDto {
  id: number;
  name: string;
}

class TestConsumerService extends BaseNatsConsumerService {
  public mockHandlers: MessageHandler[] = [];
  public mockConfig: ConsumerConfig = {
    streamName: 'TEST_STREAM',
    durableName: 'test_consumer',
    filterSubject: 'test.>',
  };

  protected getConsumerConfig(): ConsumerConfig {
    return this.mockConfig;
  }

  protected getMessageHandlers(): MessageHandler[] {
    return this.mockHandlers;
  }
}

describe('BaseNatsConsumerService', () => {
  let service: TestConsumerService;
  let natsService: any;
  let mockJsm: any;
  let mockJs: any;
  let mockConsumer: any;

  beforeEach(async () => {
    mockConsumer = {
      consume: jest.fn(),
      close: jest.fn(),
    };

    mockJsm = {
      consumers: {
        info: jest.fn(),
        add: jest.fn(),
        update: jest.fn(),
      },
    };

    mockJs = {
      consumers: {
        get: jest.fn().mockReturnValue(mockConsumer),
      },
    };

    natsService = {
      getManager: jest.fn().mockReturnValue(mockJsm),
      getJetStream: jest.fn().mockReturnValue(mockJs),
      isConnected: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NatsJetStreamService,
          useValue: natsService,
        },
        {
          provide: TestConsumerService,
          useFactory: (ns: any) => new TestConsumerService(ns, 'TestConsumerSpec'),
          inject: [NatsJetStreamService],
        },
      ],
    }).compile();

    service = module.get<TestConsumerService>(TestConsumerService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should create a new consumer if it does not exist', async () => {
      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockJsm.consumers.add).toHaveBeenCalledWith('TEST_STREAM', {
        durable_name: 'test_consumer',
        ack_policy: AckPolicy.Explicit,
        deliver_policy: DeliverPolicy.All,
        filter_subject: 'test.>',
        filter_subjects: undefined,
        max_ack_pending: 1000,
        inactive_threshold: 600_000_000_000,
      });
      expect(mockJs.consumers.get).toHaveBeenCalledWith('TEST_STREAM', 'test_consumer');
    });

    it('should update existing consumer', async () => {
      mockJsm.consumers.info.mockResolvedValue({} as any);
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockJsm.consumers.update).toHaveBeenCalledWith(
        'TEST_STREAM',
        'test_consumer',
        expect.objectContaining({
          durable_name: 'test_consumer',
          ack_policy: AckPolicy.Explicit,
        }),
      );
      expect(mockJsm.consumers.add).not.toHaveBeenCalled();
      expect(mockJs.consumers.get).toHaveBeenCalled();
    });

    it('should use filter_subjects when provided', async () => {
      service.mockConfig = {
        streamName: 'TEST_STREAM',
        durableName: 'test_consumer',
        filterSubjects: ['test.a.>', 'test.b.>'],
      };

      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockJsm.consumers.add).toHaveBeenCalledWith(
        'TEST_STREAM',
        expect.objectContaining({
          filter_subjects: ['test.a.>', 'test.b.>'],
          filter_subject: undefined,
        }),
      );
    });

    it('should use custom ack policy when provided', async () => {
      service.mockConfig = {
        streamName: 'TEST_STREAM',
        durableName: 'test_consumer',
        filterSubject: 'test.>',
        ackPolicy: AckPolicy.None,
      };

      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockJsm.consumers.add).toHaveBeenCalledWith(
        'TEST_STREAM',
        expect.objectContaining({
          ack_policy: AckPolicy.None,
        }),
      );
    });

    it('should use custom deliver policy when provided', async () => {
      service.mockConfig = {
        streamName: 'TEST_STREAM',
        durableName: 'test_consumer',
        filterSubject: 'test.>',
        deliverPolicy: DeliverPolicy.New,
      };

      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockJsm.consumers.add).toHaveBeenCalledWith(
        'TEST_STREAM',
        expect.objectContaining({
          deliver_policy: DeliverPolicy.New,
        }),
      );
    });

    it('should use custom maxMessages when provided', async () => {
      service.mockConfig = {
        streamName: 'TEST_STREAM',
        durableName: 'test_consumer',
        filterSubject: 'test.>',
        maxMessages: 50,
      };

      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockConsumer.consume).toHaveBeenCalledWith({ max_messages: 50 });
    });

    it('should handle 404 error code for missing consumer', async () => {
      const error: any = new Error('consumer not found');
      error.code = '404';
      mockJsm.consumers.info.mockRejectedValue(error);
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockJsm.consumers.add).toHaveBeenCalled();
    });
  });

  describe('message processing', () => {
    beforeEach(() => {
      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
    });

    it('should process messages with registered handlers', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const mockData = { id: 1, name: 'test' };

      service.mockHandlers = [
        {
          subject: 'test.message',
          dtoClass: TestDto,
          handler: mockHandler,
        },
      ];

      const mockMsg = {
        subject: 'test.message',
        data: new TextEncoder().encode(JSON.stringify(mockData)),
        ack: jest.fn(),
      };

      (MessageValidator.parseAndValidate as jest.Mock).mockResolvedValue(mockData);

      mockConsumer.consume.mockResolvedValue(
        (async function* () {
          yield mockMsg;
        })() as any,
      );

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(MessageValidator.parseAndValidate).toHaveBeenCalledWith(
        mockMsg,
        TestDto,
        expect.any(Object),
      );
      expect(mockHandler).toHaveBeenCalledWith(mockData);
      expect(mockMsg.ack).toHaveBeenCalled();
    });

    it('should process multiple messages sequentially', async () => {
      const mockHandler = jest.fn().mockResolvedValue(undefined);
      const mockData1 = { id: 1, name: 'test1' };
      const mockData2 = { id: 2, name: 'test2' };

      service.mockHandlers = [
        {
          subject: 'test.message',
          dtoClass: TestDto,
          handler: mockHandler,
        },
      ];

      const mockMsg1 = {
        subject: 'test.message',
        data: new TextEncoder().encode(JSON.stringify(mockData1)),
        ack: jest.fn(),
      };

      const mockMsg2 = {
        subject: 'test.message',
        data: new TextEncoder().encode(JSON.stringify(mockData2)),
        ack: jest.fn(),
      };

      (MessageValidator.parseAndValidate as jest.Mock)
        .mockResolvedValueOnce(mockData1)
        .mockResolvedValueOnce(mockData2);

      mockConsumer.consume.mockResolvedValue(
        (async function* () {
          yield mockMsg1;
          yield mockMsg2;
        })() as any,
      );

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockHandler).toHaveBeenCalledTimes(2);
      expect(mockHandler).toHaveBeenNthCalledWith(1, mockData1);
      expect(mockHandler).toHaveBeenNthCalledWith(2, mockData2);
      expect(mockMsg1.ack).toHaveBeenCalled();
      expect(mockMsg2.ack).toHaveBeenCalled();
    });

    it('should log warning and ack message when no handler is registered', async () => {
      service.mockHandlers = [];

      const mockMsg = {
        subject: 'unknown.subject',
        data: new TextEncoder().encode('{}'),
        ack: jest.fn(),
      };

      mockConsumer.consume.mockResolvedValue(
        (async function* () {
          yield mockMsg;
        })() as any,
      );

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(warnSpy).toHaveBeenCalledWith('No handler for subject: unknown.subject');
      expect(mockMsg.ack).toHaveBeenCalled();
    });

    it('should log warning and ack message when validation fails', async () => {
      const mockHandler = jest.fn();

      service.mockHandlers = [
        {
          subject: 'test.message',
          dtoClass: TestDto,
          handler: mockHandler,
        },
      ];

      const mockMsg = {
        subject: 'test.message',
        data: new TextEncoder().encode('{}'),
        ack: jest.fn(),
      };

      (MessageValidator.parseAndValidate as jest.Mock).mockResolvedValue(null);

      mockConsumer.consume.mockResolvedValue(
        (async function* () {
          yield mockMsg;
        })() as any,
      );

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(warnSpy).toHaveBeenCalledWith(
        'Invalid message data on subject test.message, skipping',
      );
      expect(mockHandler).not.toHaveBeenCalled();
      expect(mockMsg.ack).toHaveBeenCalled();
    });

    it('should ack message even when handler throws error', async () => {
      const mockHandler = jest.fn().mockRejectedValue(new Error('Handler error'));

      service.mockHandlers = [
        {
          subject: 'test.message',
          dtoClass: TestDto,
          handler: mockHandler,
        },
      ];

      const mockMsg = {
        subject: 'test.message',
        data: new TextEncoder().encode('{}'),
        ack: jest.fn(),
      };

      (MessageValidator.parseAndValidate as jest.Mock).mockResolvedValue({ id: 1 });

      mockConsumer.consume.mockResolvedValue(
        (async function* () {
          yield mockMsg;
        })() as any,
      );

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(errorSpy).toHaveBeenCalledWith(
        'Error processing message: Handler error',
        expect.any(String),
      );
      expect(mockMsg.ack).toHaveBeenCalled();
    });

    it('should handle multiple handlers for different subjects', async () => {
      const handler1 = jest.fn().mockResolvedValue(undefined);
      const handler2 = jest.fn().mockResolvedValue(undefined);

      service.mockHandlers = [
        {
          subject: 'test.subject1',
          dtoClass: TestDto,
          handler: handler1,
        },
        {
          subject: 'test.subject2',
          dtoClass: TestDto,
          handler: handler2,
        },
      ];

      const mockMsg1 = {
        subject: 'test.subject1',
        data: new TextEncoder().encode('{}'),
        ack: jest.fn(),
      };

      const mockMsg2 = {
        subject: 'test.subject2',
        data: new TextEncoder().encode('{}'),
        ack: jest.fn(),
      };

      (MessageValidator.parseAndValidate as jest.Mock).mockResolvedValue({ id: 1 });

      mockConsumer.consume.mockResolvedValue(
        (async function* () {
          yield mockMsg1;
          yield mockMsg2;
        })() as any,
      );

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(mockMsg1.ack).toHaveBeenCalled();
      expect(mockMsg2.ack).toHaveBeenCalled();
    });
  });

  describe('reconnection', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should reconnect after consumer loop error', async () => {
      let callCount = 0;
      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));

      mockConsumer.consume.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('NATS connection lost');
        }
        return (async function* () {})() as any;
      });

      await service.onModuleInit();

      // Advance past the 1s reconnect delay after first failure
      await jest.advanceTimersByTimeAsync(1500);

      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it('should wait for NATS connection before starting consumer', async () => {
      natsService.isConnected.mockReturnValue(false);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.onModuleInit();

      // Advance past the 2s waitForConnection poll interval
      await jest.advanceTimersByTimeAsync(100);

      expect(warnSpy).toHaveBeenCalledWith(
        'Waiting for NATS connection before starting consumer...',
      );

      // Simulate NATS coming back
      natsService.isConnected.mockReturnValue(true);
      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      // Advance past the 2s poll + consumer setup
      await jest.advanceTimersByTimeAsync(2500);

      expect(mockConsumer.consume).toHaveBeenCalled();
    });

    it('should handle JetStream not available after connection established', async () => {
      natsService.getManager.mockReturnValue(null);
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();

      await jest.advanceTimersByTimeAsync(1500);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Consumer error, reconnecting in'),
        expect.any(String),
      );
    });

    it('should use exponential backoff on repeated failures', async () => {
      let callCount = 0;
      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));

      mockConsumer.consume.mockImplementation(async () => {
        callCount++;
        throw new Error('NATS connection lost');
      });

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();

      // Advance past first retry (1s) + second retry (2s)
      await jest.advanceTimersByTimeAsync(3500);

      // Should have attempted multiple reconnections with increasing delays
      expect(callCount).toBeGreaterThanOrEqual(2);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Consumer error, reconnecting in'),
        expect.any(String),
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('should stop the consumer loop on shutdown', async () => {
      mockJsm.consumers.info.mockRejectedValue(new Error('consumer not found'));
      mockConsumer.consume.mockResolvedValue((async function* () {})() as any);

      await service.onModuleInit();

      const logSpy = jest.spyOn(service['logger'], 'log');
      await service.onModuleDestroy();

      expect(logSpy).toHaveBeenCalledWith('Shutting down consumer');
    });

    it('should not throw if called before onModuleInit', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });
  });
});
