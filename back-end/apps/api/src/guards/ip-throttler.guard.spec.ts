import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { IpThrottlerGuard } from './ip-throttler.guard';

describe('IpThrottlerGuard', () => {
  let guard: IpThrottlerGuard;

  beforeEach(() => {
    const storageMock: Partial<ThrottlerStorage> = {};

    const configServiceMock = {
      get: jest.fn().mockReturnValue(100),
    } as unknown as ConfigService;

    const reflector = new Reflector();

    guard = new IpThrottlerGuard(configServiceMock, storageMock as ThrottlerStorage, reflector);
  });

  it('throws HttpException when client IP cannot be determined', async () => {
    const req = { headers: {}, ip: undefined };

    try {
      await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
      fail('Expected getTracker to throw HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      if (err instanceof HttpException) {
        expect(err.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
        expect(err.message).toBe('Unable to determine client IP');
      }
    }
  });

  it('returns the ip from req.ip when present', async () => {
    const req = { headers: {}, ip: '127.0.0.1' };

    const result = await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
    expect(result).toBe('127.0.0.1');
  });

  it('returns the ip from x-forwarded-for header when present', async () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.5' }, ip: undefined };

    const result = await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
    expect(result).toBe('203.0.113.5');
  });
});
