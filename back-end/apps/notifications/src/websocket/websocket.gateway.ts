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

@WebSocketGateway({
  path: '/ws',
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(@Inject(AUTH_SERVICE) private readonly authService: ClientProxy) {}

  @WebSocketServer()
  private server: Server;

  afterInit(server: Server) {
    server.use(AuthWebsocketMiddleware(this.authService));
  }

  handleConnection(client: AuthWebsocket, ...args) {
    this.logger.log(`client connected for userId: ${client.user.id}`);
  }

  handleDisconnect(client: AuthWebsocket) {
    this.logger.log(`client disconnected for userId: ${client.user.id}`);
  }

  notifyClient({ message, content }: NotifyClientDto) {
    this.server.emit(message, { content });
  }
}
