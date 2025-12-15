import { HttpException, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { EmailThrottlerGuard } from './email-throttler.guard';

describe('EmailThrottlerGuard', () => {
  let guard: EmailThrottlerGuard;

  beforeEach(() => {
    const storageMock: Partial<ThrottlerStorage> = {};

    const options: any = {
      throttlers: [],
      storage: storageMock as ThrottlerStorage,
    };

    const reflector = new Reflector();

    guard = new EmailThrottlerGuard(options, storageMock as ThrottlerStorage, reflector);
  });

  it('throws HttpException when request body has no email', async () => {
    const req = { body: {} };

    try {
      await (guard as any).getTracker(req);
      fail('Expected getTracker to throw HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as any).status).toBe(HttpStatus.BAD_REQUEST);
      expect((err as any).message).toBe('No email specified.');
    }
  });

  it('returns the email string when provided in request body', async () => {
    const req = { body: { email: 'user@example.com' } };

    const result = await (guard as any).getTracker(req);
    expect(result).toBe('user@example.com');
  });
});
