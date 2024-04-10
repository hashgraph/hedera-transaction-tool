import { MessageBody, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { OnModuleInit } from '@nestjs/common';
import { NotifyClientDto } from './dto/notify-client.dto';
import { Server } from 'http';

//TODO WebTransport vs Websockets - by default transports = polling and websocket, not webtransport
@WebSocketGateway({
  cors: { origin: '*' },
  connectionStateRecovery: { maxDisconnectionDuration: 2*60*1000 },
})
export class WebsocketGateway implements OnModuleInit {
  @WebSocketServer()
  private server: Server;

  onModuleInit(): any {
    this.server.on('connection', (socket) => {
      console.log(`${socket.id} is connected`);
    })
  }

  @SubscribeMessage('messagename')
  onMessage(@MessageBody() body: any) {
    //If this method returns, does it send messages to all clients? I assume not.
  }

  notifyClient(dto: NotifyClientDto) {
    this.server.emit(dto.message, { content: dto.content });
  }
}