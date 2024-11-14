import { Test } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { Socket } from 'socket.io';
import { mockDeep } from 'jest-mock-extended';

import { BlacklistService } from '@app/common';

import { AuthWebsocketMiddleware } from './auth-websocket.middleware';

describe('AuthWebsocketMiddleware', () => {
  let apiServiceMock: Partial<ClientProxy>;
  let socketMock;
  let nextFunction: jest.Mock;

  const blacklistService = mockDeep<BlacklistService>();

  beforeEach(async () => {
    apiServiceMock = {
      send: jest.fn().mockReturnValue(of({ id: 'user1', name: 'Test User' })),
    };

    socketMock = {
      handshake: {
        auth: {
          token: 'bearer jwtToken',
        },
      },
      user: undefined,
    };

    nextFunction = jest.fn();

    await Test.createTestingModule({
      providers: [],
    }).compile();
  });

  it('should authenticate and attach user to socket', async () => {
    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy, blacklistService);

    await middleware(socketMock, nextFunction);

    expect(apiServiceMock.send).toHaveBeenCalledWith('authenticate-websocket-token', {
      jwt: 'jwtToken',
    });
    expect(socketMock.user).toBeDefined();
    expect(socketMock.user.id).toEqual('user1');
    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('should authenticate and attach user to socket', async () => {
    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy, blacklistService);

    const socket = {
      handshake: { auth: { token: ['bearer jwtToken'] } },
    };
    await middleware(socket as unknown as Socket, nextFunction);

    expect(apiServiceMock.send).toHaveBeenCalledWith('authenticate-websocket-token', {
      jwt: 'jwtToken',
    });
    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('should call next with error if user is not authenticated', async () => {
    apiServiceMock.send = jest.fn().mockReturnValue(of(null));

    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy, blacklistService);

    await middleware({ handshake: { auth: {} } } as Socket, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith({ name: 'Unauthorized', message: 'Unauthorized' });
  });

  it('should call next with error if user is not authenticated', async () => {
    apiServiceMock.send = jest.fn().mockReturnValue(of(null));

    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy, blacklistService);

    await middleware(socketMock, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith({ name: 'Unauthorized', message: 'Unauthorized' });
  });

  it('should call next with error on exception', async () => {
    apiServiceMock.send = jest.fn().mockImplementation(() => {
      throw new Error('Service error');
    });

    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy, blacklistService);

    await middleware(socketMock, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith({ name: 'Unauthorized', message: 'Unauthorized' });
  });

  it('should call next with error if jwt is not provided', async () => {
    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy, blacklistService);

    await middleware(
      { handshake: { auth: { token: 'bearer' } } } as unknown as Socket,
      nextFunction,
    );

    expect(nextFunction).toHaveBeenCalledWith({ name: 'Unauthorized', message: 'Unauthorized' });
  });

  it('should call next with error if the jwt is blacklisted', async () => {
    blacklistService.isTokenBlacklisted.mockResolvedValue(true);

    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy, blacklistService);

    await middleware(socketMock, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith({ name: 'Unauthorized', message: 'Unauthorized' });
  });
});
