import { Test } from '@nestjs/testing';
import { ClientProxy } from '@nestjs/microservices';
import { of } from 'rxjs';
import { AuthWebsocketMiddleware } from './auth-websocket.middleware';

describe('AuthWebsocketMiddleware', () => {
  let apiServiceMock: Partial<ClientProxy>;
  let socketMock;
  let nextFunction: jest.Mock;

  beforeEach(async () => {
    apiServiceMock = {
      send: jest.fn().mockReturnValue(of({ id: 'user1', name: 'Test User' })),
    };

    socketMock = {
      handshake: {
        headers: {
          cookie: 'Authentication=jwtToken123;',
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
    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy);

    await middleware(socketMock, nextFunction);

    expect(apiServiceMock.send).toHaveBeenCalledWith('authenticate-websocket-token', {
      jwt: 'jwtToken123',
    });
    expect(socketMock.user).toBeDefined();
    expect(socketMock.user.id).toEqual('user1');
    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('should call next with error if user is not authenticated', async () => {
    apiServiceMock.send = jest.fn().mockReturnValue(of(null));

    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy);

    await middleware(socketMock, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith({ name: 'Unauthorized', message: 'Unauthorized' });
  });

  it('should call next with error on exception', async () => {
    apiServiceMock.send = jest.fn().mockImplementation(() => {
      throw new Error('Service error');
    });

    const middleware = AuthWebsocketMiddleware(apiServiceMock as ClientProxy);

    await middleware(socketMock, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith({ name: 'Unauthorized', message: 'Unauthorized' });
  });
});
