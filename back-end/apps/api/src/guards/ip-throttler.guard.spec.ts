import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { IpThrottlerGuard } from './ip-throttler.guard';

describe('IpThrottlerGuard', () => {
  let guard: IpThrottlerGuard;

  beforeEach(() => {
    const storageMock: Partial<ThrottlerStorage> = {};

    const options: any = {
      throttlers: [],
      storage: storageMock as ThrottlerStorage,
    };

    const reflector = new Reflector();

    guard = new IpThrottlerGuard(options, storageMock as ThrottlerStorage, reflector);
  });

  it('throws HttpException when client IP cannot be determined', async () => {
    const req = { headers: {}, ip: undefined };

    try {
      await (guard as any).getTracker(req);
      fail('Expected getTracker to throw HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as any).status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect((err as any).message).toBe('Unable to determine client IP');
    }
  });

  it('returns the ip from req.ip when present', async () => {
    const req = { headers: {}, ip: '127.0.0.1' };

    const result = await (guard as any).getTracker(req);
    expect(result).toBe('127.0.0.1');
  });

  it('returns the ip from x-forwarded-for header when present', async () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.5' }, ip: undefined };

    const result = await (guard as any).getTracker(req);
    expect(result).toBe('203.0.113.5');
  });
});
