import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import { UserStatus } from '@entities';

import { VerifiedUserGuard } from './verified-user.guard';

describe('VerifiedUserGuard', () => {
  let guard: VerifiedUserGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        VerifiedUserGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<VerifiedUserGuard>(VerifiedUserGuard);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should allow access if user is verified', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { status: UserStatus.NONE },
        }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'get').mockReturnValue(false);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access if ALLOW_NON_VERIFIED_USER is true', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { status: UserStatus.NEW },
        }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'get').mockReturnValue(true);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access if user is not verified and ALLOW_NON_VERIFIED_USER is false', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { status: UserStatus.NEW },
        }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;

    jest.spyOn(reflector, 'get').mockReturnValue(false);

    expect(guard.canActivate(context)).toBe(false);
  });
});
