import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import { NotifyClientDto } from './dtos/notify-client.dto';
import { Server, Socket } from 'socket.io';
import { AuthWebsocket, AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';
import { AUTH_SERVICE } from '@app/common';
import { ClientProxy } from '@nestjs/microservices';

//TODO WebTransport vs Websockets - by default transports = polling and websocket, not webtransport
@WebSocketGateway({
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  constructor(@Inject(AUTH_SERVICE) private readonly authService: ClientProxy) {}

  @WebSocketServer()
  private server: Server;

  afterInit(server: Server): any {
    server.use(AuthWebsocketMiddleware(this.authService));
  }

  handleConnection(client: Socket, ...args): any {
    this.logger.log(`client connected ${client.id}`);
  }

  handleDisconnect(client: Socket): any {
    this.logger.log(`client disconnected ${client.id}`);
  }

  //TODO check with the team to see how they want the data delivered
  @SubscribeMessage('test')
  async onMessage(
    @ConnectedSocket() socket: AuthWebsocket,
    @MessageBody() body: any,
  ): Promise<any> {
    const dto: NotifyClientDto = { message: 'test', content: body };
    this.notifyClient(dto);
    // Return doesn't appear to do anything, as far as the client goes?
    return body;
    //If this method returns, does it send messages to all clients? I assume not.
  }

  notifyClient({ message, content }: NotifyClientDto) {
    this.server.emit(message, { content });
  }
}
