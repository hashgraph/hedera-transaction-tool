import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { mockDeep } from 'jest-mock-extended';

import { SchedulerService } from './scheduler.service';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => mockDeep<Redis>()),
  };
});

describe('SchedulerService', () => {
  let service: SchedulerService;
  const configService = mockDeep<ConfigService>();
  const pubClient = mockDeep<Redis>();
  const subClient = mockDeep<Redis>();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: ConfigService,
          useValue: configService,
        },
      ],
    }).compile();

    service = module.get<SchedulerService>(SchedulerService);
    service.pubClient = pubClient;
    service.subClient = subClient;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addListener', () => {
    it('should add a listener for expiration events', async () => {
      await service.addListener(jest.fn());

      expect(subClient.on).toHaveBeenCalledWith('message', expect.any(Function));
    });
  });

  describe('addReminder', () => {
    it('should add a key with correct date', async () => {
      const key = 'test';
      const date = new Date();

      await service.addReminder(key, date);

      expect(pubClient.set).toHaveBeenCalledWith(
        `schedule:${key}`,
        `schedule:${key}`,
        'EXAT',
        Math.floor(date.getTime() / 1000),
      );
    });
  });
});
