import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';

import { AUTH_SERVICE, NotifyClientDto } from '@app/common';

import { AuthWebsocket, AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';
import { roomKeys } from './helpers';

@WebSocketGateway({
  path: '/ws',
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(@Inject(AUTH_SERVICE) private readonly authService: ClientProxy) {}

  @WebSocketServer()
  private io: Server;

  afterInit(io: Server) {
    io.use(AuthWebsocketMiddleware(this.authService));
  }

  async handleConnection(socket: AuthWebsocket) {
    /* Connection logs */
    this.logger.log(`Socket client connected for User ID: ${socket.user.id}`);
    // console.log('Socket client connected with initial transport', socket.conn.transport.name);
    // socket.conn.once('upgrade', () => {
    //   /* called when the transport is upgraded (i.e. from HTTP long-polling to WebSocket) */
    //   console.log('upgraded transport', socket.conn.transport.name);
    // });

    /* Join user room */
    socket.join(roomKeys.USER_KEY(socket.user.id));
  }

  handleDisconnect(socket: AuthWebsocket) {
    this.logger.log(`Socket socket disconnected for User ID: ${socket.user.id}`);
  }

  notifyClient({ message, content }: NotifyClientDto) {
    this.io.emit(message, { content });
  }
}
