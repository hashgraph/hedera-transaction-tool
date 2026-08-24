import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IpResetPasswordUniqueEmailGuard } from './ip-reset-password-unique-email.guard';

let mockRedisInstance: {
  scard: jest.Mock;
  sadd: jest.Mock;
  expire: jest.Mock;
};

jest.mock('ioredis', () => ({
  Redis: jest.fn().mockImplementation(() => mockRedisInstance),
}));

describe('IpResetPasswordUniqueEmailGuard', () => {
  let guard: IpResetPasswordUniqueEmailGuard;

  const buildContext = (req: Record<string, unknown>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    mockRedisInstance = {
      scard: jest.fn(),
      sadd: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
    };

    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
      get: jest.fn().mockReturnValue(3),
    } as unknown as ConfigService;

    guard = new IpResetPasswordUniqueEmailGuard(configServiceMock);
  });

  it('throws HttpException when client IP cannot be determined', async () => {
    const req = { headers: {}, ip: undefined, body: { email: 'a@test.com' } };

    await expect(guard.canActivate(buildContext(req))).rejects.toMatchObject({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Unable to determine client IP',
    });
    expect(mockRedisInstance.scard).not.toHaveBeenCalled();
  });

  it('returns true without touching redis when no email is supplied', async () => {
    const req = { headers: {}, ip: '127.0.0.1', body: {} };

    await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);
    expect(mockRedisInstance.scard).not.toHaveBeenCalled();
  });

  it('allows the request and records the email when under the limit', async () => {
    const req = { headers: {}, ip: '127.0.0.1', body: { email: 'a@test.com' } };
    mockRedisInstance.scard.mockResolvedValueOnce(0).mockResolvedValueOnce(1);

    await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);

    expect(mockRedisInstance.scard).toHaveBeenCalledTimes(2);
    expect(mockRedisInstance.scard).toHaveBeenCalledWith('reset:ip-unique-email:127.0.0.1');
    expect(mockRedisInstance.sadd).toHaveBeenCalledWith(
      'reset:ip-unique-email:127.0.0.1',
      'a@test.com',
    );
    expect(mockRedisInstance.expire).toHaveBeenCalledWith(
      'reset:ip-unique-email:127.0.0.1',
      600,
      'NX',
    );
  });

  it('rejects before recording the email when already at the limit', async () => {
    const req = { headers: {}, ip: '127.0.0.1', body: { email: 'a@test.com' } };
    mockRedisInstance.scard.mockResolvedValueOnce(3);

    await expect(guard.canActivate(buildContext(req))).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too Many Requests',
    });
    expect(mockRedisInstance.sadd).not.toHaveBeenCalled();
  });

  it('rejects when a concurrent request pushes the count over the limit', async () => {
    const req = { headers: {}, ip: '127.0.0.1', body: { email: 'a@test.com' } };
    mockRedisInstance.scard.mockResolvedValueOnce(2).mockResolvedValueOnce(4);

    await expect(guard.canActivate(buildContext(req))).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too Many Requests',
    });
    expect(mockRedisInstance.sadd).toHaveBeenCalled();
  });
});
