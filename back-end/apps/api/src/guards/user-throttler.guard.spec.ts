// File: `back-end/apps/api/src/guards/user-throttler.guard.spec.ts`
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard', () => {
  let guard: UserThrottlerGuard;

  beforeEach(() => {
    const storageMock: Partial<ThrottlerStorage> = {};

    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue(100),
    } as unknown as ConfigService;

    const reflector = new Reflector();

    guard = new UserThrottlerGuard(configServiceMock, storageMock as ThrottlerStorage, reflector);
  });

  it('throws HttpException when there is no user on the request', async () => {
    const req = { user: undefined };

    try {
      await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
      fail('Expected getTracker to throw HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      if (err instanceof HttpException) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.message).toBe('No user connected.');
      }
    }
  });

  it('returns the user id when a user is present', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
    expect(result).toBe('user-123');
  });
});
