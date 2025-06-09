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

import {
  AUTH_SERVICE,
  BlacklistService,
  NotifyClientDto
} from '@app/common';

import { AuthWebsocket, AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';
import { roomKeys } from './helpers';
import { DebouncedNotificationBatcher } from '../utils';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  path: '/ws',
  cors: { origin: true, methods: ['GET', 'POST'], credentials: true },
  connectionStateRecovery: { maxDisconnectionDuration: 2 * 60 * 1000 },
  transports: ['websocket', 'polling'],
})
export class WebsocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(WebsocketGateway.name);

  private batcher: DebouncedNotificationBatcher;

  constructor(
    @Inject(AUTH_SERVICE) private readonly authService: ClientProxy,
    private readonly blacklistService: BlacklistService,
    private readonly configService: ConfigService,
  ) {
    this.batcher = new DebouncedNotificationBatcher(
      this.processMessages.bind(this),
      500,
      200,
      2000,
      this.configService.get('REDIS_URL'),
      'inapp-notifications',
    );
  }

  @WebSocketServer()
  private io: Server;

  afterInit(io: Server) {
    io.use(AuthWebsocketMiddleware(this.authService, this.blacklistService));
  }

  async handleConnection(socket: AuthWebsocket) {
    /* Connection logs */
    this.logger.log(`Socket client connected for User ID: ${socket.user?.id}`);

    if (!socket.user?.id) {
      this.logger.error('Socket client connected without user');
      return socket.disconnect();
    }

    /* Join user room */
    socket.join(roomKeys.USER_KEY(socket.user?.id));
  }

  handleDisconnect(socket: AuthWebsocket) {
    this.logger.log(`Socket socket disconnected for User ID: ${socket.user?.id}`);
  }

  async notifyClient({ message, content }: NotifyClientDto) {
    const newMessage = new NotificationMessage(message, [content]);
    await this.batcher.add(newMessage);
  }

  async notifyUser(userId: number, message: string, data) {
    const newMessage = new NotificationMessage(message, [data]);
    await this.batcher.add(newMessage, userId);
  }

  private async processMessages(groupKey: number | null, messages: NotificationMessage[]) {
    const groupedMessages = messages.reduce((map, msg) => {
      if (!map.has(msg.message)) {
        map.set(msg.message, []);
      }
      map.get(msg.message)!.push(...msg.content);
      return map;
    }, new Map<string, string[]>());

    for (const [message, content] of groupedMessages.entries()) {
      if (groupKey) {
        this.io.to(roomKeys.USER_KEY(groupKey)).emit(message, content);
      } else {
        this.io.emit(message, content);
      }
    }
  };
}

class NotificationMessage {
  constructor(
    public readonly message: string,
    public readonly content: string[],
  ) {}
}
