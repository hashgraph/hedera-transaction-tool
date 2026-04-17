import { Test, TestingModule } from '@nestjs/testing';
import { NatsStreamInitializerService } from './nats-stream-initializer.service';
import { NatsJetStreamService } from './nats-jetstream.service';

describe('NatsStreamInitializerService', () => {
  let service: NatsStreamInitializerService;
  let natsService: any;
  let mockJsm: any;

  beforeEach(async () => {
    mockJsm = {
      streams: {
        info: jest.fn(),
        add: jest.fn(),
        update: jest.fn(),
      },
    };

    natsService = {
      isConnected: jest.fn().mockReturnValue(true),
      getManager: jest.fn().mockReturnValue(mockJsm),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NatsStreamInitializerService,
        {
          provide: NatsJetStreamService,
          useValue: natsService,
        },
      ],
    }).compile();

    service = module.get<NatsStreamInitializerService>(
      NatsStreamInitializerService,
    );
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize streams successfully when NATS is connected', async () => {
      mockJsm.streams.info.mockRejectedValue(new Error('stream not found'));

      await service.onModuleInit();
      // Allow the async initializeWithRetry to complete
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockJsm.streams.add).toHaveBeenCalledTimes(2);
      expect(mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NOTIFICATIONS_QUEUE' }),
      );
      expect(mockJsm.streams.add).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'NOTIFICATIONS_FAN_OUT' }),
      );
    });

    it('should update existing streams', async () => {
      mockJsm.streams.info.mockResolvedValue({});

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockJsm.streams.update).toHaveBeenCalledTimes(2);
      expect(mockJsm.streams.add).not.toHaveBeenCalled();
    });

    it('should handle 404 error code for missing streams', async () => {
      const error: any = new Error('not found');
      error.code = '404';
      mockJsm.streams.info.mockRejectedValue(error);

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockJsm.streams.add).toHaveBeenCalledTimes(2);
    });
  });

  describe('infinite retry', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should retry indefinitely when NATS is not connected', async () => {
      natsService.isConnected.mockReturnValue(false);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.onModuleInit();

      // First warn fires immediately, then sleeps 2s before next attempt
      await jest.advanceTimersByTimeAsync(100);
      const initialCalls = warnSpy.mock.calls.length;
      expect(initialCalls).toBeGreaterThanOrEqual(1);

      // Advance through several retries
      await jest.advanceTimersByTimeAsync(2100); // 2s sleep
      await jest.advanceTimersByTimeAsync(4100); // 4s sleep
      await jest.advanceTimersByTimeAsync(8100); // 8s sleep

      // Should have retried multiple times without giving up
      expect(warnSpy.mock.calls.length).toBeGreaterThan(initialCalls);
      expect(natsService.getManager).not.toHaveBeenCalled();
    });

    it('should succeed after NATS becomes available', async () => {
      natsService.isConnected.mockReturnValue(false);
      mockJsm.streams.info.mockRejectedValue(new Error('stream not found'));

      await service.onModuleInit();

      // Let it retry once while disconnected
      await jest.advanceTimersByTimeAsync(2100);

      // NATS comes back
      natsService.isConnected.mockReturnValue(true);

      await jest.advanceTimersByTimeAsync(4100);

      expect(mockJsm.streams.add).toHaveBeenCalled();
    });

    it('should retry when initializeStreams throws', async () => {
      let callCount = 0;
      natsService.getManager.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return null; // Will cause 'JetStream manager not available' error
        }
        return mockJsm;
      });
      mockJsm.streams.info.mockRejectedValue(new Error('stream not found'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();

      // First attempt fails (2s delay)
      await jest.advanceTimersByTimeAsync(2100);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stream initialization failed'),
      );

      // Second attempt fails (4s delay)
      await jest.advanceTimersByTimeAsync(4100);

      // Third attempt succeeds
      await jest.advanceTimersByTimeAsync(100);

      expect(mockJsm.streams.add).toHaveBeenCalled();
    });

    it('should cap backoff at 30 seconds', async () => {
      natsService.isConnected.mockReturnValue(false);

      const warnSpy = jest.spyOn(service['logger'], 'warn');

      await service.onModuleInit();

      // Advance through delays: 2s, 4s, 8s, 16s, 30s (capped), 30s
      const delays = [2000, 4000, 8000, 16000, 30000, 30000];
      for (const delay of delays) {
        await jest.advanceTimersByTimeAsync(delay + 100);
      }

      expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(6);
    });

    it('should reset backoff delay when NATS reconnects', async () => {
      natsService.isConnected.mockReturnValue(false);

      await service.onModuleInit();

      // Let delay escalate: 2s, 4s, 8s
      await jest.advanceTimersByTimeAsync(2100);
      await jest.advanceTimersByTimeAsync(4100);
      await jest.advanceTimersByTimeAsync(8100);

      // NATS reconnects but initializeStreams fails on first try
      natsService.isConnected.mockReturnValue(true);
      natsService.getManager.mockReturnValue(null); // Causes error

      // Next attempt at 16s delay (still in disconnected backoff)
      await jest.advanceTimersByTimeAsync(16100);

      // After connection detected, delay resets to 2s
      // The error retry should use 2s (reset), then doubled to 4s
      natsService.getManager.mockReturnValue(mockJsm);
      mockJsm.streams.info.mockRejectedValue(new Error('stream not found'));

      // Should succeed after the reset 2s delay (not 32s)
      await jest.advanceTimersByTimeAsync(2100);

      expect(mockJsm.streams.add).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should interrupt pending sleep and exit loop', async () => {
      natsService.isConnected.mockReturnValue(false);

      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.onModuleInit();

      // Let it enter the retry loop
      await jest.advanceTimersByTimeAsync(100);

      await service.onModuleDestroy();

      expect(logSpy).toHaveBeenCalledWith(
        'Stream initialization stopped (shutdown)',
      );
    });

    it('should not throw if called before onModuleInit', async () => {
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should handle errors during shutdown gracefully', async () => {
      const fatalError = new Error('Shutdown failure');
      (service as any).initPromise = Promise.reject(fatalError);
      (service as any).initPromise.catch(() => {});

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleDestroy();

      expect(errorSpy).toHaveBeenCalledWith(
        'Error during stream initialization shutdown',
        expect.stringContaining('Shutdown failure'),
      );
    });
  });

  describe('createOrUpdateStream', () => {
    it('should re-throw non-404 errors from streams.info', async () => {
      mockJsm.streams.info.mockRejectedValue(new Error('Permission denied'));

      const errorSpy = jest.spyOn(service['logger'], 'error');

      await service.onModuleInit();
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Stream initialization failed'),
      );
      expect(mockJsm.streams.add).not.toHaveBeenCalled();
    });
  });
});
