import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerStorage, ThrottlerStorageService } from '@nestjs/throttler';

import { CLIENT_IP_KEY } from '@app/common';

import {
  EmailThrottlerGuard,
  IpLoginThrottlerGuard,
  IpResetPasswordThrottlerGuard,
  IpThrottlerGuard,
  UserThrottlerGuard,
} from '../guards';

// Fake HTTP context whose request satisfies every guard's getTracker.
const makeContext = (): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({
        ip: '1.2.3.4',
        [CLIENT_IP_KEY]: '1.2.3.4',
        headers: {},
        body: { email: 'user@example.com' },
        user: { id: 'user-1' },
      }),
      getResponse: () => ({ header: () => undefined }),
    }),
    getHandler: () => function handler() {},
    getClass: () => class Ctrl {},
  }) as unknown as ExecutionContext;

// Count consecutive allowed requests before the guard throttles.
const countAllowed = async (guard: ThrottlerGuard) => {
  let allowed = 0;
  for (let i = 0; i < 200; i++) {
    try {
      await guard.canActivate(makeContext());
      allowed++;
    } catch {
      break;
    }
  }
  return allowed;
};

describe('throttler guard independence', () => {
  it('uses the documented limits when throttler configuration is absent', () => {
    const get = jest.fn((_key: string, defaultValue: number) => defaultValue);
    const config = { get } as unknown as ConfigService;
    const storage: ThrottlerStorage = new ThrottlerStorageService();
    const reflector = new Reflector();

    new IpThrottlerGuard(config, storage, reflector);
    new EmailThrottlerGuard(config, storage, reflector);
    new UserThrottlerGuard(config, storage, reflector);
    new IpLoginThrottlerGuard(config, storage, reflector);
    new IpResetPasswordThrottlerGuard(config, storage, reflector);

    expect(get.mock.calls).toEqual([
      ['GLOBAL_MINUTE_LIMIT', 10_000],
      ['GLOBAL_SECOND_LIMIT', 1_000],
      ['ANONYMOUS_MINUTE_LIMIT', 3],
      ['ANONYMOUS_FIVE_SECOND_LIMIT', 1],
      ['USER_MINUTE_LIMIT', 100],
      ['USER_SECOND_LIMIT', 10],
      ['LOGIN_IP_MINUTE_LIMIT', 20],
      ['LOGIN_IP_TEN_SECOND_LIMIT', 5],
      ['RESET_IP_MINUTE_LIMIT', 5],
      ['RESET_IP_TEN_SECOND_LIMIT', 1],
    ]);
  });

  it('resolves each guard through Nest dependency injection', async () => {
    const module = await Test.createTestingModule({
      providers: [
        IpThrottlerGuard,
        EmailThrottlerGuard,
        UserThrottlerGuard,
        IpLoginThrottlerGuard,
        IpResetPasswordThrottlerGuard,
        Reflector,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(10) },
        },
        {
          provide: ThrottlerStorage,
          useValue: new ThrottlerStorageService(),
        },
      ],
    }).compile();

    expect(module.get(IpThrottlerGuard)).toBeInstanceOf(IpThrottlerGuard);
    expect(module.get(EmailThrottlerGuard)).toBeInstanceOf(EmailThrottlerGuard);
    expect(module.get(UserThrottlerGuard)).toBeInstanceOf(UserThrottlerGuard);
    expect(module.get(IpLoginThrottlerGuard)).toBeInstanceOf(IpLoginThrottlerGuard);
    expect(module.get(IpResetPasswordThrottlerGuard)).toBeInstanceOf(IpResetPasswordThrottlerGuard);

    await module.close();
  });

  // Each guard defines its own limits and shares one storage instance;
  // they must not interfere with one another.
  it('each guard enforces only its own limit against a shared storage', async () => {
    const storage: ThrottlerStorage = new ThrottlerStorageService();
    const reflector = new Reflector();

    // Ip guard: both throttlers limited to 2 -> allows 2 in a burst.
    const ipConfig = { get: jest.fn().mockReturnValue(2) } as unknown as ConfigService;
    // Email guard: both throttlers limited to 3 -> allows 3 in a burst.
    const emailConfig = { get: jest.fn().mockReturnValue(3) } as unknown as ConfigService;

    // User guard: 100/min + 10/sec -> the 10/sec window dominates a burst.
    const userConfig = {
      get: jest.fn((key: string) => (key === 'USER_SECOND_LIMIT' ? 10 : 100)),
    } as unknown as ConfigService;
    // Login-IP guard: both throttlers limited to 4 -> allows 4 in a burst.
    const loginConfig = { get: jest.fn().mockReturnValue(4) } as unknown as ConfigService;
    // Reset-password-IP guard: both throttlers limited to 1 -> allows 1 in a burst.
    const resetConfig = { get: jest.fn().mockReturnValue(1) } as unknown as ConfigService;

    const ipGuard = new IpThrottlerGuard(ipConfig, storage, reflector);
    const emailGuard = new EmailThrottlerGuard(emailConfig, storage, reflector);
    const userGuard = new UserThrottlerGuard(userConfig, storage, reflector);
    const loginGuard = new IpLoginThrottlerGuard(loginConfig, storage, reflector);
    const resetGuard = new IpResetPasswordThrottlerGuard(resetConfig, storage, reflector);

    await ipGuard.onModuleInit();
    await emailGuard.onModuleInit();
    await userGuard.onModuleInit();
    await loginGuard.onModuleInit();
    await resetGuard.onModuleInit();

    expect(await countAllowed(ipGuard)).toBe(2);
    expect(await countAllowed(emailGuard)).toBe(3);
    expect(await countAllowed(userGuard)).toBe(10);
    expect(await countAllowed(loginGuard)).toBe(4);
    expect(await countAllowed(resetGuard)).toBe(1);
  });
});
