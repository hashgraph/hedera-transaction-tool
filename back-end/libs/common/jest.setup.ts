jest.mock('ioredis', () => {
  const createRedisMock = () => ({
    subscribe: jest.fn().mockResolvedValue(1),
    on: jest.fn().mockReturnThis(),
    set: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    rpush: jest.fn().mockResolvedValue(1),
    lrange: jest.fn().mockResolvedValue([]),
    pexpire: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    disconnect: jest.fn(),
  });

  return {
    Redis: jest.fn().mockImplementation(() => createRedisMock()),
    default: jest.fn().mockImplementation(() => createRedisMock()),
  };
});
