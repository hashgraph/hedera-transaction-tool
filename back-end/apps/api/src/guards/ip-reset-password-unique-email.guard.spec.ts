import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { IpResetPasswordUniqueEmailGuard } from './ip-reset-password-unique-email.guard';

let mockMultiChain: {
  sadd: jest.Mock;
  expire: jest.Mock;
  scard: jest.Mock;
  exec: jest.Mock;
};

let mockRedisInstance: {
  scard: jest.Mock;
  multi: jest.Mock;
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
    mockMultiChain = {
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      scard: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    mockRedisInstance = {
      scard: jest.fn().mockResolvedValue(0), // pre-check: nothing recorded yet by default
      multi: jest.fn().mockReturnValue(mockMultiChain),
    };

    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
      get: jest.fn().mockReturnValue(3),
    } as unknown as ConfigService;

    guard = new IpResetPasswordUniqueEmailGuard(configServiceMock);
  });

  describe('RESET_IP_UNIQUE_EMAIL_LIMIT validation', () => {
    const buildConfig = (limitValue: unknown) =>
      ({
        getOrThrow: jest.fn().mockReturnValue('redis://localhost:6379'),
        get: jest.fn((key: string, defaultValue?: unknown) =>
          key === 'RESET_IP_UNIQUE_EMAIL_LIMIT' ? limitValue : defaultValue,
        ),
      }) as unknown as ConfigService;

    it.each([['abc'], [''], [undefined], [null], ['0'], [0], [-1], [NaN]])(
      'throws at construction time for an invalid limit (%s)',
      (limitValue) => {
        expect(() => new IpResetPasswordUniqueEmailGuard(buildConfig(limitValue))).toThrow(
          'RESET_IP_UNIQUE_EMAIL_LIMIT must be a positive number',
        );
      },
    );

    it('accepts a valid positive numeric string', () => {
      expect(() => new IpResetPasswordUniqueEmailGuard(buildConfig('5'))).not.toThrow();
    });
  });

  it('returns true without touching redis when no email is supplied', async () => {
    const req = { clientIp: '127.0.0.1', body: {} };

    await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);
    expect(mockRedisInstance.scard).not.toHaveBeenCalled();
    expect(mockRedisInstance.multi).not.toHaveBeenCalled();
  });

  it.each([[123], [['a@test.com']], [{ address: 'a@test.com' }], [null], ['   ']])(
    'returns true without touching redis when email is %p, not a real string',
    async (badEmail) => {
      const req = { clientIp: '127.0.0.1', body: { email: badEmail } };

      await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);
      expect(mockRedisInstance.scard).not.toHaveBeenCalled();
      expect(mockRedisInstance.multi).not.toHaveBeenCalled();
    },
  );

  it('normalizes email casing and surrounding whitespace before using it as the set member', async () => {
    const req = { clientIp: '127.0.0.1', body: { email: '  Test@Example.COM  ' } };
    mockRedisInstance.scard.mockResolvedValueOnce(0);
    mockMultiChain.exec.mockResolvedValueOnce([
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);

    expect(mockMultiChain.sadd).toHaveBeenCalledWith('reset:ip-unique-email:127.0.0.1', 'test@example.com');
  });

  it('allows the request and records the email when under the limit', async () => {
    const req = { clientIp: '127.0.0.1', body: { email: 'a@test.com' } };
    mockRedisInstance.scard.mockResolvedValueOnce(2); // 2 distinct emails so far, not tripped
    mockMultiChain.exec.mockResolvedValueOnce([
      [null, 1],
      [null, 1],
      [null, 3],
    ]);

    await expect(guard.canActivate(buildContext(req))).resolves.toBe(true);

    expect(mockMultiChain.sadd).toHaveBeenCalledWith('reset:ip-unique-email:127.0.0.1', 'a@test.com');
    expect(mockMultiChain.expire).toHaveBeenCalledWith('reset:ip-unique-email:127.0.0.1', 600, 'NX');
    expect(mockMultiChain.scard).toHaveBeenCalledWith('reset:ip-unique-email:127.0.0.1');
  });

  it('trips the lockout when a new distinct email pushes the count over the limit', async () => {
    const req = { clientIp: '127.0.0.1', body: { email: 'fourth@test.com' } };
    mockRedisInstance.scard.mockResolvedValueOnce(3); // at the limit, not yet tripped
    mockMultiChain.exec.mockResolvedValueOnce([
      [null, 1],
      [null, 1],
      [null, 4], // this email pushed it to 4
    ]);

    await expect(guard.canActivate(buildContext(req))).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too Many Requests',
    });
    // The email that tripped it is left in the set on purpose -- no compensating removal.
    expect(mockMultiChain.exec).toHaveBeenCalledTimes(1);
  });

  it('rejects immediately once already tripped, even for a previously-used email, without adding anything', async () => {
    const req = { clientIp: '127.0.0.1', body: { email: 'a@test.com' } };
    mockRedisInstance.scard.mockResolvedValueOnce(4); // already over the limit from an earlier trip

    await expect(guard.canActivate(buildContext(req))).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
      message: 'Too Many Requests',
    });
    expect(mockRedisInstance.multi).not.toHaveBeenCalled();
  });

  it('throws when the transaction is aborted', async () => {
    const req = { clientIp: '127.0.0.1', body: { email: 'a@test.com' } };
    mockRedisInstance.scard.mockResolvedValueOnce(1);
    mockMultiChain.exec.mockResolvedValueOnce(null);

    await expect(guard.canActivate(buildContext(req))).rejects.toThrow(
      'Redis transaction aborted while checking the reset-password unique-email limit',
    );
  });

  it('rethrows an error from one of the pipelined commands', async () => {
    const req = { clientIp: '127.0.0.1', body: { email: 'a@test.com' } };
    const err = new Error('boom');
    mockRedisInstance.scard.mockResolvedValueOnce(1);
    mockMultiChain.exec.mockResolvedValueOnce([
      [null, 1],
      [null, 1],
      [err, null],
    ]);

    await expect(guard.canActivate(buildContext(req))).rejects.toThrow('boom');
  });
});
