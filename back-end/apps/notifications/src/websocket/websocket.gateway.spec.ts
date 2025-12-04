import { Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { Server } from 'socket.io';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { mockDeep } from 'jest-mock-extended';

import { AUTH_SERVICE, NotifyClientDto, BlacklistService } from '@app/common';
import { User } from '@entities';

import { WebsocketGateway } from './websocket.gateway';

import { AuthWebsocket, AuthWebsocketMiddleware } from './middlewares/auth-websocket.middleware';
import { roomKeys } from './helpers';

jest.mock('./middlewares/auth-websocket.middleware');

describe('WebsocketGateway', () => {
  let gateway: WebsocketGateway;
  const authService = mockDeep<ClientProxy>();
  const blacklistService = mockDeep<BlacklistService>();
  const configService = mockDeep<ConfigService>();
  const authWebsocket: Partial<AuthWebsocket> = {
    user: {
      id: 1,
    } as User,
    join: jest.fn(),
  };

  beforeEach(async () => {
    jest.useFakeTimers();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebsocketGateway,
        {
          provide: AUTH_SERVICE,
          useValue: authService,
        },
        {
          provide: BlacklistService,
          useValue: blacklistService,
        },
        {
          provide: ConfigService,
          useValue: configService,
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

  afterEach(() => {
    jest.clearAllTimers();
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
      expect(AuthWebsocketMiddleware).toHaveBeenCalledWith(authService, blacklistService);
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

    it('should handle connection without user id', () => {
      const invalidSocket: Partial<AuthWebsocket> = {
        user: {} as User,
        disconnect: jest.fn(),
        join: jest.fn(),
      };

      gateway.handleConnection(invalidSocket as AuthWebsocket);

      expect(invalidSocket.disconnect).toHaveBeenCalled();
      expect(invalidSocket.join).not.toHaveBeenCalled();
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
    it('should add a new message to the batcher', () => {
      const payload: NotifyClientDto = { message: 'Test message', content: 'Test content' };

      const batcherAddSpy = jest.spyOn(gateway['batcher'], 'add');

      gateway.notifyClient(payload);

      expect(batcherAddSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: payload.message,
          content: [payload.content],
        }),
      );
    });
  });

  describe('notifyUser', () => {
    it('should add a new message to the batcher with a user group key', () => {
      const userId = 1;
      const message = 'Test message';
      const data = 'Test data';

      const batcherAddSpy = jest.spyOn(gateway['batcher'], 'add');

      gateway.notifyUser(userId, message, data);

      expect(batcherAddSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          content: [data],
        }),
        userId,
      );
    });

    it('should add a new message to the batcher with a user group key and array of data', () => {
      const userId = 1;
      const message = 'Test message';
      const data = 'Test data';

      const batcherAddSpy = jest.spyOn(gateway['batcher'], 'add');

      gateway.notifyUser(userId, message, [data]);

      expect(batcherAddSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: message,
          content: [data],
        }),
        userId,
      );
    });
  });

  describe('processMessages', () => {
    it('should emit messages to a specific user room when groupKey is provided', async () => {
      const groupKey = 1;
      const messages = [
        { message: 'message1', content: ['content1'] },
        { message: 'message1', content: ['content2'] },
        { message: 'message2', content: ['content3'] },
      ];

      //@ts-expect-error - accessing private method for testing
      await gateway.processMessages(groupKey, messages);

      //@ts-expect-error - accessing private method for testing
      expect(gateway.io.to).toHaveBeenCalledWith(roomKeys.USER_KEY(groupKey));
      //@ts-expect-error - accessing private method for testing
      expect(gateway.io.to(roomKeys.USER_KEY(groupKey)).emit).toHaveBeenCalledWith('message1', ['content1', 'content2']);
      //@ts-expect-error - accessing private method for testing
      expect(gateway.io.to(roomKeys.USER_KEY(groupKey)).emit).toHaveBeenCalledWith('message2', ['content3']);
    });

    it('should emit messages globally when groupKey is null', async () => {
      const groupKey = null;
      const messages = [
        { message: 'message1', content: ['content1'] },
        { message: 'message1', content: ['content2'] },
        { message: 'message2', content: ['content3'] },
      ];

      //@ts-expect-error - accessing private method for testing
      await gateway.processMessages(groupKey, messages);

      //@ts-expect-error - accessing private method for testing
      expect(gateway.io.emit).toHaveBeenCalledWith('message1', ['content1', 'content2']);
      //@ts-expect-error - accessing private method for testing
      expect(gateway.io.emit).toHaveBeenCalledWith('message2', ['content3']);
    });
  });

  // describe('notifyClient', () => {
  //   it('should emit message to client with content', () => {
  //     const payload: NotifyClientDto = { message: 'Test message', content: 'Test content' };
  //
  //     gateway.notifyClient(payload);
  //
  //     //@ts-expect-error - accessing private property for testing
  //     expect(gateway.io.emit).toHaveBeenCalledWith(payload.message, {
  //       content: payload.content,
  //     });
  //   });
  // });
  //
  // describe('notifyUser', () => {
  //   it('should emit message to user room with data', () => {
  //     const userId = 1;
  //     const message = 'Test message';
  //     const data = 'Test data';
  //
  //     gateway.notifyUser(userId, message, data);
  //
  //     //@ts-expect-error - accessing private property for testing
  //     expect(gateway.io.to).toHaveBeenCalledWith(roomKeys.USER_KEY(userId));
  //     //@ts-expect-error - accessing private property for testing
  //     expect(gateway.io.to(roomKeys.USER_KEY(userId)).emit).toHaveBeenCalledWith(message, { data });
  //   });
  // });
});
