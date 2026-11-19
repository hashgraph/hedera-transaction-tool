import { RedisIoAdapter } from './redis-io.adapter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import { Redis } from 'ioredis';
import { mock } from 'jest-mock-extended';
import { Server } from 'socket.io';
import { LEGACY_IOREDIS_OPTIONS } from '@app/common';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn(),
  };
});
jest.mock('@socket.io/redis-streams-adapter');

describe('RedisIoAdapter', () => {
  let redisIoAdapter: RedisIoAdapter;
  let mockRedisClient: Redis;
  let mockCreateAdapter: jest.Mock;

  beforeEach(() => {
    redisIoAdapter = new RedisIoAdapter();
    mockRedisClient = new Redis();
    mockCreateAdapter = createAdapter as jest.Mock;
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('should connect to Redis and create an adapter', () => {
    const url = 'redis://localhost:6379';
    redisIoAdapter.connectToRedis(url);

    expect(Redis).toHaveBeenCalledWith(url, LEGACY_IOREDIS_OPTIONS);
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockRedisClient);
  });

  it('should reject server creation before Redis is initialized', () => {
    const createServer = jest.spyOn(IoAdapter.prototype, 'createIOServer');

    expect(() => redisIoAdapter.createIOServer(3000)).toThrow(
      'Call connectToRedis() before creating the Socket.IO server',
    );
    expect(createServer).not.toHaveBeenCalled();
  });

  it.each([3000, undefined])('should create an IO server on port %s and set the adapter', port => {
    const mockServer = mock<Server>();
    const adapterConstructor = jest.fn();
    mockCreateAdapter.mockReturnValue(adapterConstructor);
    redisIoAdapter.connectToRedis('redis://localhost:6379');

    jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(mockServer);

    const server = redisIoAdapter.createIOServer(port);

    expect(IoAdapter.prototype.createIOServer).toHaveBeenCalledWith(port, undefined);
    expect(mockServer.adapter).toHaveBeenCalledWith(adapterConstructor);
    expect(server).toBe(mockServer);
  });
});
