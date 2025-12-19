import { Socket } from 'socket.io';
import { FrontendVersionWebsocketMiddleware } from './frontend-version-websocket.middleware';

describe('FrontendVersionWebsocketMiddleware', () => {
  let nextFunction: jest.Mock;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  // Helper to create a mock Socket with given version in headers or auth
  const makeSocket = (
    version?: string | string[],
    options?: { useAuth?: boolean; ip?: string },
  ): Socket => {
    const { useAuth = false, ip = '127.0.0.1' } = options || {};

    return {
      handshake: {
        headers: useAuth ? {} : { 'x-frontend-version': version },
        auth: useAuth ? { version } : {},
        address: ip,
      },
      disconnect: jest.fn(),
    } as unknown as Socket;
  };

  beforeEach(() => {
    nextFunction = jest.fn();

    // Spy on Logger prototype methods
    // Note: The middleware uses a module-level logger instance
    const { Logger } = require('@nestjs/common');
    loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Version validation - allowed connections', () => {
    it('should allow connection when version is above minimum', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('2.0.0');

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should allow connection when version equals minimum', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('1.0.0');

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should allow connection when patch version is higher', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('1.0.5');

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should allow connection when minor version is higher', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('1.5.0');

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should allow connection when major version is higher', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('3.0.0');

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Version validation - rejected connections', () => {
    it('should reject connection when version is below minimum', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('0.9.0');

      middleware(socket, nextFunction);

      // Note: socket.io automatically disconnects after next(error), no explicit disconnect call needed
      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('no longer supported');
      expect(err.message).toContain('0.9.0');
      expect(err.message).toContain('1.0.0');
    });

    it('should reject connection when minor version is below minimum', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.5.0');
      const socket = makeSocket('1.4.9');

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
    });

    it('should reject connection when major version is below minimum', () => {
      const middleware = FrontendVersionWebsocketMiddleware('2.0.0');
      const socket = makeSocket('1.9.9');

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('Missing version handling', () => {
    it('should reject connection when version header is missing', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket(undefined);

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Frontend version is required');
    });

    it('should reject connection when both header and auth.version are missing', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = {
        handshake: {
          headers: {},
          auth: {},
          address: '127.0.0.1',
        },
        disconnect: jest.fn(),
      } as unknown as Socket;

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err.message).toContain('Frontend version is required');
    });

    it('should treat empty array as missing version', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      // Empty array should be treated as missing, not as invalid format
      const socket = makeSocket([]);

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Frontend version is required');
    });
  });

  describe('Invalid version format handling', () => {
    it('should reject connection with invalid version format', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('not-a-version');

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Invalid frontend version format');
    });

    it('should reject connection with empty version string', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('');

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should handle version with leading "v" prefix', () => {
      // semver.clean handles "v1.0.0" -> "1.0.0"
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('v1.0.0');

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject connection when minimum version config is invalid', () => {
      const middleware = FrontendVersionWebsocketMiddleware('invalid-version');
      const socket = makeSocket('1.0.0');

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err.message).toContain('Server configuration error');
    });
  });

  describe('Version source handling', () => {
    it('should read version from x-frontend-version header', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('1.5.0', { useAuth: false });

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it('should read version from auth.version when header is missing', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('1.5.0', { useAuth: true });

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should handle version as array (takes first element)', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket(['1.5.0', '2.0.0']);

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should reject when version array contains invalid first element', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket(['invalid', '1.5.0']);

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err.message).toContain('Invalid frontend version format');
    });
  });

  describe('Logging behavior', () => {
    it('should log warning when version is missing', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket(undefined, { ip: '192.168.1.50' });

      middleware(socket, nextFunction);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing frontend version'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('192.168.1.50'));
    });

    it('should log warning when version is below minimum', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('0.5.0', { ip: '10.0.0.1' });

      middleware(socket, nextFunction);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Frontend version 0.5.0 is below minimum 1.0.0'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('10.0.0.1'));
    });

    it('should log warning when version format is invalid', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      const socket = makeSocket('garbage-version');

      middleware(socket, nextFunction);

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid frontend version format'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('garbage-version'));
    });

    it('should log error when minimum version config is invalid (at factory time)', () => {
      FrontendVersionWebsocketMiddleware('bad-config');

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid MINIMUM_SUPPORTED_FRONTEND_VERSION format'),
      );
    });

    it('should log error when minimum version config is invalid (at runtime)', () => {
      const middleware = FrontendVersionWebsocketMiddleware('bad-config');
      const socket = makeSocket('1.0.0');

      middleware(socket, nextFunction);

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Server configuration error'),
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle prerelease versions correctly', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      // 1.0.0-alpha is less than 1.0.0 in semver
      const socket = makeSocket('1.0.0-alpha');

      middleware(socket, nextFunction);

      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should handle version with build metadata', () => {
      const middleware = FrontendVersionWebsocketMiddleware('1.0.0');
      // 1.0.0+build is equal to 1.0.0 in semver
      const socket = makeSocket('1.0.0+build.123');

      middleware(socket, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
      expect(socket.disconnect).not.toHaveBeenCalled();
    });

    it('should create independent middleware instances', () => {
      const middleware1 = FrontendVersionWebsocketMiddleware('1.0.0');
      const middleware2 = FrontendVersionWebsocketMiddleware('2.0.0');

      const socket1 = makeSocket('1.5.0');
      const socket2 = makeSocket('1.5.0');

      middleware1(socket1, nextFunction);
      expect(socket1.disconnect).not.toHaveBeenCalled();

      nextFunction.mockClear();

      // middleware2 rejects version 1.5.0 because minimum is 2.0.0
      middleware2(socket2, nextFunction);
      expect(socket2.disconnect).not.toHaveBeenCalled();
      const err = nextFunction.mock.calls[0][0];
      expect(err).toBeInstanceOf(Error);
    });
  });
});

