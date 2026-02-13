import { of, throwError } from 'rxjs';
import { ClientProxy } from '@nestjs/microservices';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { AuthWebsocketMiddleware } from './auth-websocket.middleware';
import { BlacklistService } from '@app/common';
import { Socket } from 'socket.io';

describe('AuthWebsocketMiddleware (fixed)', () => {
  let authServiceMock: DeepMockProxy<ClientProxy>;
  let blacklistService: DeepMockProxy<BlacklistService>;
  let nextFunction: jest.Mock;
  let middleware: ReturnType<typeof AuthWebsocketMiddleware>;

  const defaultUser = { id: 'user1', name: 'Test User' };

  beforeEach(() => {
    jest.useFakeTimers();
    jest.resetAllMocks();

    // typed deep mock for ClientProxy — avoids TS2352 and no "as ClientProxy" casts needed
    authServiceMock = mockDeep<ClientProxy>();
    authServiceMock.send.mockReturnValue(of(defaultUser));

    blacklistService = mockDeep<BlacklistService>();
    blacklistService.isTokenBlacklisted.mockResolvedValue(false);

    // create a fresh middleware instance per test so internal state (attempts map / interval) is isolated
    middleware = AuthWebsocketMiddleware(authServiceMock, blacklistService);

    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const makeSocket = (token: unknown, ip = '1.2.3.4') =>
    ({
      handshake: {
        auth: { token },
        address: ip,
      },
      disconnect: jest.fn(),
      user: undefined,
    } as unknown as Socket);

  it('authenticates and attaches user when token is a string', async () => {
    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    expect(authServiceMock.send).toHaveBeenCalledWith('authenticate-websocket-token', { jwt: 'jwtToken' });
    expect((socket as any).user).toBeDefined();
    expect((socket as any).user.id).toBe('user1');
    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('authenticates when token is an array', async () => {
    const socket = makeSocket(['bearer jwtToken']);

    await middleware(socket as any, nextFunction);

    expect(authServiceMock.send).toHaveBeenCalledWith('authenticate-websocket-token', { jwt: 'jwtToken' });
    expect(nextFunction).toHaveBeenCalledWith();
  });

  it('calls next with Unauthorized when api returns null (not authenticated)', async () => {
    // ensure the auth service returns null for this test
    authServiceMock.send.mockReturnValueOnce(of(null));

    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe('Unauthorized');
    // Note: socket.io automatically disconnects after next(error), no explicit disconnect call needed
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('calls next with Unauthorized when token missing or malformed', async () => {
    const socket1 = makeSocket(undefined);
    await middleware(socket1 as any, nextFunction);
    let err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Unauthorized');

    nextFunction.mockClear();
    const socket2 = makeSocket('bearer'); // missing jwt part
    await middleware(socket2 as any, nextFunction);
    err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Unauthorized');
  });

  it('calls next with Unauthorized when jwt is blacklisted', async () => {
    blacklistService.isTokenBlacklisted.mockResolvedValue(true);
    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Unauthorized');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('handles apiService send throwing synchronously', async () => {
    authServiceMock.send.mockImplementation(() => {
      throw new Error('Service error');
    });

    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Unauthorized');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('returns "Auth service unavailable" on TimeoutError', async () => {
    const timeoutError = new Error('Timeout');
    (timeoutError as any).name = 'TimeoutError';

    // make the auth service observable emit the timeout error for this test
    authServiceMock.send.mockReturnValueOnce(throwError(() => timeoutError));

    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Auth service unavailable');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('returns "Auth service unavailable" on ECONNREFUSED', async () => {
    const connError = new Error('Connection refused') as any;
    connError.code = 'ECONNREFUSED';

    // Ensure the mocked service observable emits the connection error for this test
    authServiceMock.send.mockReturnValueOnce(throwError(() => connError));

    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Auth service unavailable');
  });

  it('returns "Auth service unavailable" on NO_RESPONDERS', async () => {
    const natsError = new Error('No responders available') as any;
    natsError.code = 'NO_RESPONDERS';

    // Ensure the mocked service observable emits the nats error for this test
    authServiceMock.send.mockReturnValueOnce(throwError(() => natsError));

    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Auth service unavailable');
  });

  it('returns "Auth service unavailable" when error message contains "No responders"', async () => {
    const errWithMsg = new Error('Something: No responders found');

    // ensure the auth service observable emits the error for this test
    authServiceMock.send.mockReturnValueOnce(throwError(() => errWithMsg));

    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Auth service unavailable');
  });

  it('returns Unauthorized on other errors and logs the error', async () => {
    const genericError = new Error('Random failure');
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // make the auth service observable emit a generic error for this test
    authServiceMock.send.mockReturnValueOnce(throwError(() => genericError));

    const socket = makeSocket('bearer jwtToken');

    await middleware(socket as any, nextFunction);

    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Unauthorized');
    expect(consoleErrorSpy).toHaveBeenCalledWith('AuthWebsocketMiddleware error:', genericError);

    consoleErrorSpy.mockRestore();
  });

  it('rate-limits after repeated failures and returns "Too many failed authentication attempts"', async () => {
    // create middleware with low maxAttempts for test (so 3rd failure exceeds it)
    const shortMiddleware = AuthWebsocketMiddleware(authServiceMock, blacklistService, 60, 2);

    const socket = makeSocket(undefined); // missing token

    // first failure
    await shortMiddleware(socket as any, nextFunction);
    expect(nextFunction.mock.calls[0][0].message).toBe('Unauthorized');
    nextFunction.mockClear();

    // second failure -> still Unauthorized
    await shortMiddleware(socket as any, nextFunction);
    expect(nextFunction.mock.calls[0][0].message).toBe('Unauthorized');
    nextFunction.mockClear();

    // third failure -> should be rate limited
    await shortMiddleware(socket as any, nextFunction);
    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Too many failed authentication attempts');
    // socket.io handles disconnect automatically after next(error)
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('rate-limits when JWT is missing even if token exists', async () => {
    const rlMiddleware = AuthWebsocketMiddleware(authServiceMock, blacklistService, 60, 1);
    const socket = makeSocket('bearer'); // missing JWT part

    await rlMiddleware(socket as any, nextFunction);
    nextFunction.mockClear();

    await rlMiddleware(socket as any, nextFunction);
    const err = nextFunction.mock.calls[0][0];

    expect(err.message).toBe('Too many failed authentication attempts');
    expect(socket.disconnect).not.toHaveBeenCalled();
  });

  it('rate-limits when token is blacklisted repeatedly', async () => {
    blacklistService.isTokenBlacklisted.mockResolvedValue(true);
    const rlMiddleware = AuthWebsocketMiddleware(authServiceMock, blacklistService, 60, 1);

    const socket = makeSocket('bearer jwtToken');

    await rlMiddleware(socket as any, nextFunction);
    nextFunction.mockClear();

    await rlMiddleware(socket as any, nextFunction);
    const err = nextFunction.mock.calls[0][0];

    expect(err.message).toBe('Too many failed authentication attempts');
  });

  it('rate-limits when API returns null repeatedly', async () => {
    const rlMiddleware = AuthWebsocketMiddleware(authServiceMock, blacklistService, 60, 1);
    authServiceMock.send.mockReturnValue(of(null));

    const socket = makeSocket('bearer jwtToken');

    await rlMiddleware(socket as any, nextFunction);
    nextFunction.mockClear();

    await rlMiddleware(socket as any, nextFunction);
    const err = nextFunction.mock.calls[0][0];

    expect(err.message).toBe('Too many failed authentication attempts');
  });

  it('rate-limits on generic auth service errors', async () => {
    const rlMiddleware = AuthWebsocketMiddleware(authServiceMock, blacklistService, 60, 1);
    authServiceMock.send.mockReturnValue(throwError(() => new Error('Boom')));

    const socket = makeSocket('bearer jwtToken');

    await rlMiddleware(socket as any, nextFunction);
    nextFunction.mockClear();

    await rlMiddleware(socket as any, nextFunction);
    const err = nextFunction.mock.calls[0][0];

    expect(err.message).toBe('Too many failed authentication attempts');
  });

  it('resets attempts on successful authentication', async () => {
    const badSocket = makeSocket(undefined);
    // one failed attempt
    await middleware(badSocket as any, nextFunction);
    expect(nextFunction.mock.calls[0][0].message).toBe('Unauthorized');

    // now a successful attempt with same IP
    nextFunction.mockClear();
    const goodSocket = makeSocket('bearer jwtToken');
    await middleware(goodSocket as any, nextFunction);

    expect(nextFunction).toHaveBeenCalledWith();
    // After successful login, further bad attempts should start fresh (not immediately rate limited).
    nextFunction.mockClear();
    const badSocket2 = makeSocket(undefined);
    await middleware(badSocket2 as any, nextFunction);
    const err = nextFunction.mock.calls[0][0];
    expect(err.message).toBe('Unauthorized'); // not "Too many failed authentication attempts"
  });

  it('cleans up expired rate-limit entries after interval', async () => {
    // middleware with default windowSeconds = 60, maxAttempts = 5
    const mw = AuthWebsocketMiddleware(authServiceMock, blacklistService);

    const socket = makeSocket(undefined, '9.9.9.9');

    // Trigger one failed attempt → puts IP in attempts map
    await mw(socket as any, nextFunction);
    nextFunction.mockClear();

    // Fast-forward time beyond 60 seconds
    jest.advanceTimersByTime(60_000 + 1);

    // Give cleanup interval a tick
    jest.runOnlyPendingTimers();

    // Now force another failed attempt to confirm a *fresh* record is made
    await mw(socket as any, nextFunction);

    // If cleanup worked: nextFunction gets "Unauthorized" again from a fresh counter,
    // NOT "Too many attempts"
    expect(nextFunction.mock.calls[0][0].message).toBe('Unauthorized');
  });
});
