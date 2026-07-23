import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { ThrottlerStorage } from '@nestjs/throttler';
import { EmailThrottlerGuard } from './email-throttler.guard';

describe('EmailThrottlerGuard', () => {
  let guard: EmailThrottlerGuard;

  beforeEach(() => {
    const storageMock: Partial<ThrottlerStorage> = {};

    const configServiceMock = {
      getOrThrow: jest.fn().mockReturnValue(100),
    } as unknown as ConfigService;

    const reflector = new Reflector();

    guard = new EmailThrottlerGuard(configServiceMock, storageMock as ThrottlerStorage, reflector);
  });

  it('throws HttpException when request body has no email', async () => {
    const req = { body: {} };

    try {
      await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
      fail('Expected getTracker to throw HttpException');
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      if (err instanceof HttpException) {
        expect(err.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(err.message).toBe('No email specified.');
      }
    }
  });

  it('returns the email string when provided in request body', async () => {
    const req = { body: { email: 'user@example.com' } };

    const result = await (guard as unknown as { getTracker(request: Record<string, unknown>): Promise<string> }).getTracker(req);
    expect(result).toBe('user@example.com');
  });
});
