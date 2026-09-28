import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { CLIENT_IP_KEY } from '@app/common';
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

  it('returns the IP resolved by ClientIpMiddleware, never a raw header or req.ip', async () => {
    const req = { [CLIENT_IP_KEY]: '203.0.113.5', ip: '10.0.0.1', headers: { 'x-forwarded-for': '198.51.100.1' } };

    const result = await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
    expect(result).toBe('203.0.113.5');
  });
});
