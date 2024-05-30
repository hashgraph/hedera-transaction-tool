import { Inject, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

import { AUTH_SERVICE, NotifyClientDto } from '@app/common';

import { AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';

@WebSocketGateway({
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

  handleConnection(client: Socket) {
    this.logger.log(`client connected ${client.id}`);
    setTimeout(() => {
      this.notifyClient({ message: 'test', content: 'test' });
    }, 1000);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`client disconnected ${client.id}`);
  }

  notifyClient({ message, content }: NotifyClientDto) {
    this.server.emit(message, { content });
  }
}
