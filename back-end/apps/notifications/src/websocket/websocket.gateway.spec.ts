import { Test, TestingModule } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { Server } from 'socket.io';
import { mockDeep } from 'jest-mock-extended';

import { AUTH_SERVICE, NotifyClientDto } from '@app/common';
import { User } from '@entities';

import { WebsocketGateway } from './websocket.gateway';

import { AuthWebsocket, AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';
import { Logger } from 'nestjs-pino';

jest.mock('./middlewares/auth-websocket.middleware');

describe('WebsocketController', () => {
  let gateway: WebsocketGateway;
  const authService = mockDeep<ClientProxy>();
  const authWebsocket: Partial<AuthWebsocket> = {
    user: {
      id: 1,
    } as User,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        {
          provide: AUTH_SERVICE,
          useValue: authService,
        },
      ],
    }).compile();

    gateway = module.get<WebsocketGateway>(WebsocketGateway);

    //@ts-expect-error - accessing private property for testing
    gateway.logger = mockDeep<Logger>();
    //@ts-expect-error - accessing private property for testing
    gateway.server = { emit: jest.fn() } as unknown as Server;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit', () => {
    it('should apply auth middleware after init', () => {
      const server: Partial<Server> = {
        use: jest.fn(),
      };

      gateway.afterInit(server as Server);

      expect(server.use).toHaveBeenCalled();
      expect(AuthWebsocketMiddleware).toHaveBeenCalledWith(authService);
    });
  });

  describe('handleConnection', () => {
    it('should log client connected with userId', () => {
      gateway.handleConnection(authWebsocket as AuthWebsocket);

      //@ts-expect-error - accessing private property for testing
      expect(gateway.logger.log).toHaveBeenCalledWith(
        `client connected for userId: ${authWebsocket.user.id}`,
      );
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnected with userId', () => {
      gateway.handleDisconnect(authWebsocket as AuthWebsocket);

      //@ts-expect-error - accessing private property for testing
      expect(gateway.logger.log).toHaveBeenCalledWith(
        `client disconnected for userId: ${authWebsocket.user.id}`,
      );
    });
  });

  describe('notifyClient', () => {
    it('should emit message to client with content', () => {
      const payload: NotifyClientDto = { message: 'Test message', content: 'Test content' };

      gateway.notifyClient(payload);

      //@ts-expect-error - accessing private property for testing
      expect(gateway.server.emit).toHaveBeenCalledWith(payload.message, {
        content: payload.content,
      });
    });
  });
});
