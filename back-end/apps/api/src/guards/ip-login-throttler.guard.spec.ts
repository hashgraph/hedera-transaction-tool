import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { IpLoginThrottlerGuard } from './ip-login-throttler.guard';

describe('IpLoginThrottlerGuard', () => {
  let guard: IpLoginThrottlerGuard;

  beforeEach(() => {
    const storageMock: Partial<ThrottlerStorage> = {};

    const configServiceMock = {
      get: jest.fn().mockReturnValue(100),
    } as unknown as ConfigService;

    const reflector = new Reflector();

    guard = new IpLoginThrottlerGuard(configServiceMock, storageMock as ThrottlerStorage, reflector);
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

  it('prefers the cf-connecting-ip header when present', async () => {
    const req = {
      headers: { 'cf-connecting-ip': '198.51.100.1', 'x-forwarded-for': '203.0.113.5' },
      ip: '127.0.0.1',
    };

    const result = await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
    expect(result).toBe('198.51.100.1');
  });
});
