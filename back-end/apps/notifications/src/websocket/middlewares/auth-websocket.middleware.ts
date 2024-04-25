import { Socket } from 'socket.io';
import { User } from '@entities';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';

export interface AuthWebsocket extends Socket {
  user: User;
}

export type SocketIOMiddleware = {
  (client: Socket, next: (err?: Error) => void);
}

export const AuthWebsocketMiddleware = (apiService: ClientProxy): SocketIOMiddleware => {
  return async (socket: AuthWebsocket, next) => {
    try {
      const jwt = socket.handshake.headers.authorization.split(' ')[1];
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