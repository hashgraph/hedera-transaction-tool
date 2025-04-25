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

import { AUTH_SERVICE, BlacklistService, NotifyClientDto } from '@app/common';

import { AuthWebsocket, AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';
import { roomKeys } from './helpers';
import { DebouncedNotificationBatcher, NotificationMessage } from '@app/common/utils/notifications/debounced-notification-batcher';

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
  ) {
    this.batcher = new DebouncedNotificationBatcher(
      (groupKey, messages) => processMessages(this.io, groupKey, messages),
      1000,
      200,
      5000,
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
    // console.log('Socket client connected with initial transport', socket.conn.transport.name);
    // socket.conn.once('upgrade', () => {
    //   /* called when the transport is upgraded (i.e. from HTTP long-polling to WebSocket) */
    //   console.log('upgraded transport', socket.conn.transport.name);
    // });

    /* Join user room */
    socket.join(roomKeys.USER_KEY(socket.user?.id));
  }

  handleDisconnect(socket: AuthWebsocket) {
    this.logger.log(`Socket socket disconnected for User ID: ${socket.user?.id}`);
  }

  notifyClient({ message, content }: NotifyClientDto) {
    const newMessage = new NotificationMessage(message, [content]);
    this.batcher.add(newMessage);
  }

  notifyUser(userId: number, message: string, data) {
    const newMessage = new NotificationMessage(message, [data]);
    this.batcher.add(newMessage, userId);
  }
}

const processMessages = async (io: Server, groupKey: number | null, messages: NotificationMessage[]) => {
  const groupedMessages = messages.reduce((map, msg) => {
    if (!map.has(msg.message)) {
      map.set(msg.message, []);
    }
    map.get(msg.message)!.push(...msg.content);
    return map;
  }, new Map<string, string[]>());

  for (const [message, content] of groupedMessages.entries()) {
    if (groupKey) {
      io.to(roomKeys.USER_KEY(groupKey)).emit(message, content);
    } else {
      io.emit(message, content);
    }
  }
};
