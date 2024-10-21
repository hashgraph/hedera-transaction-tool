import { ClientProxy } from '@nestjs/microservices';
import { Socket } from 'socket.io';
import { firstValueFrom } from 'rxjs';

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
  apiService: ClientProxy,
  blacklistService: BlacklistService,
): SocketIOMiddleware => {
  return async (socket: AuthWebsocket, next) => {
    try {
      /* Get the JWT from the header */
      const { authorization } = socket.handshake.headers;

      if (!authorization) {
        next({ name: 'Unauthorized', message: 'Unauthorized' });
        return;
      }

      const jwt = (Array.isArray(authorization) ? authorization[0] : authorization).split(' ')[1];

      if (!jwt) {
        next({ name: 'Unauthorized', message: 'Unauthorized' });
        return;
      }

      const isBlacklisted = await blacklistService.isTokenBlacklisted(jwt);
      if (isBlacklisted) {
        next({ name: 'Unauthorized', message: 'Unauthorized' });
        return;
      }

      /* Request authentication of the jwt from the API service. */
      const response = apiService.send<User>('authenticate-websocket-token', {
        jwt,
      });
      const user = await firstValueFrom(response);

      if (user) {
        socket.user = user;
        next();
      } else {
        next({ name: 'Unauthorized', message: 'Unauthorized' });
      }
    } catch (error) {
      next({ name: 'Unauthorized', message: 'Unauthorized' });
    }
  };
};
