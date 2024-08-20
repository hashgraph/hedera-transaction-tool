import { RedisIoAdapter } from './redis-io.adapter';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-streams-adapter';
import { Redis } from 'ioredis';

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
  });

  it('should connect to Redis and create an adapter', () => {
    const url = 'redis://localhost:6379';
    redisIoAdapter.connectToRedis(url);

    expect(Redis).toHaveBeenCalledWith(url);
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockRedisClient);
  });

  it('should create an IO server and set the adapter', () => {
    const port = 3000;
    const mockServer = {
      adapter: jest.fn(),
    };

    jest.spyOn(IoAdapter.prototype, 'createIOServer').mockReturnValue(mockServer);

    const server = redisIoAdapter.createIOServer(port);

    expect(IoAdapter.prototype.createIOServer).toHaveBeenCalledWith(port, undefined);
    expect(mockServer.adapter).toHaveBeenCalledWith(redisIoAdapter['adapterConstructor']);
    expect(server).toBe(mockServer);
  });
});
