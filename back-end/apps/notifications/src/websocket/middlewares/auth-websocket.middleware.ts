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
}

export const AuthWebsocketMiddleware = (apiService: ClientProxy): SocketIOMiddleware => {
  return async (socket: AuthWebsocket, next) => {
    try {
      const { Authentication: jwt } = cookie.parse(socket.handshake.headers.cookie);
      const response = apiService.send<User>('authenticate-websocket-token', { jwt });
      const user = await firstValueFrom(response);
      if (user) {
        socket.user = user;
        next();
      } else {
        next({name: 'Unauthorized', message: 'Unauthorized'});
      }
    } catch (error) {
      next({name: 'Unauthorized', message: 'Unauthorized'});
    }
  };
};