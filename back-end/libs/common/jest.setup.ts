import { mockDeep } from 'jest-mock-extended';
import type { Redis } from 'ioredis';

jest.mock('ioredis', () => {
  return {
    Redis: jest.fn().mockImplementation(() => mockDeep<Redis>()),
    default: jest.fn().mockImplementation(() => mockDeep<Redis>()),
  };
});
