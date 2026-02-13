import { ClientProxy } from '@nestjs/microservices';
import { Socket } from 'socket.io';
import { firstValueFrom } from 'rxjs';
import { timeout } from 'rxjs/operators';

import { BlacklistService } from '@app/common';
import { User } from '@entities';

export interface AuthWebsocket extends Socket {
  user: User;
}

export type SocketIOMiddleware = {
  (client: Socket, next: (err?: Error) => void);
};

/* This middleware will intercept connection requests during the handshake enabling authentication to
 * occur before the connection is established.
 */
export const AuthWebsocketMiddleware = (
  authService: ClientProxy,
  blacklistService: BlacklistService,
  windowSeconds: number = 60,
  maxAttempts: number = 5,
): SocketIOMiddleware => {
  // In-memory rate limiting
  const attempts = new Map<string, { count: number; resetAt: number }>();

  // Cleanup expired entries every minute
  setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of attempts.entries()) {
      if (now > record.resetAt) {
        attempts.delete(ip);
      }
    }
  }, 60_000);

  const trackAttempt = (ip: string): boolean => {
    const now = Date.now();
    const record = attempts.get(ip);

    if (!record || now > record.resetAt) {
      attempts.set(ip, { count: 1, resetAt: now + windowSeconds * 1000 });
      return false;
    }

    record.count++;
    return record.count > maxAttempts;
  };

  const resetAttempts = (ip: string): void => {
    attempts.delete(ip);
  };

  return async (socket: AuthWebsocket, next) => {
    const ip = socket.handshake.address;

    try {
      /* Get the JWT from the header */
      const { token } = socket.handshake.auth;

      if (!token) {
        const isRateLimited = trackAttempt(ip);
        if (isRateLimited) {
          return next(new Error('Too many failed authentication attempts'));
        }
        return next(new Error('Unauthorized'));
      }

      const jwt = (Array.isArray(token) ? token[0] : token).split(' ')[1];

      if (!jwt) {
        const isRateLimited = trackAttempt(ip);
        if (isRateLimited) {
          return next(new Error('Too many failed authentication attempts'));
        }
        return next(new Error('Unauthorized'));
      }

      const isBlacklisted = await blacklistService.isTokenBlacklisted(jwt);
      if (isBlacklisted) {
        const isRateLimited = trackAttempt(ip);
        if (isRateLimited) {
          return next(new Error('Too many failed authentication attempts'));
        }
        return next(new Error('Unauthorized'));
      }

      /* Request authentication of the jwt from the API service. */
      const response = authService
        .send<User>('authenticate-websocket-token', {
          jwt,
        })
        .pipe(timeout(2000));
      const user = await firstValueFrom(response);

      if (!user) {
        const isRateLimited = trackAttempt(ip);
        if (isRateLimited) {
          return next(new Error('Too many failed authentication attempts'));
        }
        return next(new Error('Unauthorized'));
      }

      // Success - reset rate limit counter
      resetAttempts(ip);
      socket.user = user;
      next();
    } catch (err) {
      const e = err as any;

      // Note: socket.io automatically disconnects after next(error), no need for explicit disconnect
      if (
        e?.name === 'TimeoutError' ||
        e?.code === 'ECONNREFUSED' ||
        e?.code === 'NO_RESPONDERS' ||
        e?.message?.includes('No responders')
      ) {
        return next(new Error('Auth service unavailable'));
      } else {
        // Rate limit other auth failures
        const isRateLimited = trackAttempt(ip);
        if (isRateLimited) {
          return next(new Error('Too many failed authentication attempts'));
        }

        console.error('AuthWebsocketMiddleware error:', err);
        return next(new Error('Unauthorized'));
      }
    }
  };
};
