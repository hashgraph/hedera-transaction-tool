// File: `back-end/apps/api/src/guards/user-throttler.guard.spec.ts`
import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { UserThrottlerGuard } from './user-throttler.guard';

describe('UserThrottlerGuard', () => {
  let guard: UserThrottlerGuard;

  beforeEach(() => {
    const storageMock: Partial<ThrottlerStorage> = {};

    const options: any = {
      throttlers: [],
      storage: storageMock as ThrottlerStorage,
    };

    const reflector = new Reflector();

    guard = new UserThrottlerGuard(options, storageMock as ThrottlerStorage, reflector);
  });

  it('throws HttpException when there is no user on the request', async () => {
    const req = { user: undefined };

    try {
      await (guard as any).getTracker(req);
      fail('Expected getTracker to throw HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as any).status).toBe(HttpStatus.BAD_REQUEST);
      expect((err as any).message).toBe('No user connected.');
    }
  });

  it('returns the user id when a user is present', async () => {
    const req = { user: { id: 'user-123' } };

    const result = await (guard as any).getTracker(req);
    expect(result).toBe('user-123');
  });
});
