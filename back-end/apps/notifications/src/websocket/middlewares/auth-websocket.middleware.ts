import { Socket } from 'socket.io';
import { User } from '@entities';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

const cookie = require('cookie');

export interface AuthWebsocket extends Socket {
  user: User;
}

export type SocketIOMiddleware = {
  (client: Socket, next: (err?: Error) => void);
};

/* This middleware will intercept connection requests during the handshake enabling authentication to
 * occur before the connection is established.
 */
export const AuthWebsocketMiddleware = (apiService: ClientProxy): SocketIOMiddleware => {
  return async (socket: AuthWebsocket, next) => {
    try {
      // Get the cookie from the header. This is the httponly cookie which contains the Authentication jwt.
      const { Authentication: jwt } = cookie.parse(socket.handshake.headers.cookie);
      // Request authentication of the jwt from the api service.
      const response = apiService.send<User>('authenticate-websocket-token', { jwt });
      const user = await firstValueFrom(response);
      // If the user is returned, the connection is authorized.
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
