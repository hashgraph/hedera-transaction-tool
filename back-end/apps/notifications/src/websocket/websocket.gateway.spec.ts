import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Server } from 'socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import { mockDeep } from 'jest-mock-extended';

import { AUTH_SERVICE, NotifyClientDto } from '@app/common';
import { User } from '@entities';

import { WebsocketGateway } from './websocket.gateway';

import { AuthWebsocket, AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';
import { roomKeys } from './helpers';

jest.mock('./middlewares/auth-websocket.middleware');

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  const authService = mockDeep<ClientProxy>();
  const authWebsocket: Partial<AuthWebsocket> = {
    user: {
      id: 1,
    } as User,
    join: jest.fn(),
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
    gateway.io = {
      emit: jest.fn(),
      to: jest.fn().mockReturnThis(),
    };
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
        `Socket client connected for User ID: ${authWebsocket.user.id}`,
      );
    });

    it('should join user room', () => {
      gateway.handleConnection(authWebsocket as AuthWebsocket);

      expect(authWebsocket.join).toHaveBeenCalledWith(roomKeys.USER_KEY(authWebsocket.user.id));
    });
  });

  describe('handleDisconnect', () => {
    it('should log client disconnected with userId', () => {
      gateway.handleDisconnect(authWebsocket as AuthWebsocket);

      //@ts-expect-error - accessing private property for testing
      expect(gateway.logger.log).toHaveBeenCalledWith(
        `Socket socket disconnected for User ID: ${authWebsocket.user.id}`,
      );
    });
  });

  describe('notifyClient', () => {
    it('should emit message to client with content', () => {
      const payload: NotifyClientDto = { message: 'Test message', content: 'Test content' };

      gateway.notifyClient(payload);

      //@ts-expect-error - accessing private property for testing
      expect(gateway.io.emit).toHaveBeenCalledWith(payload.message, {
        content: payload.content,
      });
    });
  });

  describe('notifyUser', () => {
    it('should emit message to user room with data', () => {
      const userId = 1;
      const message = 'Test message';
      const data = 'Test data';

      gateway.notifyUser(userId, message, data);

      //@ts-expect-error - accessing private property for testing
      expect(gateway.io.to).toHaveBeenCalledWith(roomKeys.USER_KEY(userId));
      //@ts-expect-error - accessing private property for testing
      expect(gateway.io.to(roomKeys.USER_KEY(userId)).emit).toHaveBeenCalledWith(message, { data });
    });
  });
});
