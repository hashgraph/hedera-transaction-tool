import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { FrontendVersionGuard } from './frontend-version.guard';

describe('FrontendVersionGuard', () => {
  let guard: FrontendVersionGuard;
  let configService: ConfigService;
  let loggerWarnSpy: jest.SpyInstance;
  let loggerErrorSpy: jest.SpyInstance;

  // Helper to create mock ExecutionContext with given headers
  const createMockContext = (headers: Record<string, string | undefined>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          ip: '127.0.0.1',
        }),
      }),
    } as unknown as ExecutionContext;
  };

  beforeEach(() => {
    // Create mock ConfigService
    configService = {
      get: jest.fn().mockReturnValue('1.0.0'),
    } as unknown as ConfigService;

    guard = new FrontendVersionGuard(configService);

    // Spy on logger methods to verify logging behavior
    loggerWarnSpy = jest.spyOn((guard as any).logger, 'warn').mockImplementation();
    loggerErrorSpy = jest.spyOn((guard as any).logger, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Version validation', () => {
    it('should allow request when version is above minimum', () => {
      // Frontend version 2.0.0 is above minimum 1.0.0
      const context = createMockContext({ 'x-frontend-version': '2.0.0' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('should allow request when version equals minimum', () => {
      // Frontend version 1.0.0 equals minimum 1.0.0
      const context = createMockContext({ 'x-frontend-version': '1.0.0' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(loggerWarnSpy).not.toHaveBeenCalled();
    });

    it('should reject request when version is below minimum with 426 status', () => {
      // Frontend version 0.9.0 is below minimum 1.0.0
      const context = createMockContext({ 'x-frontend-version': '0.9.0' });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(426);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.minimumSupportedVersion).toBe('1.0.0');
      }
    });

    it('should allow request when patch version differs but still valid', () => {
      // Frontend version 1.0.1 is above minimum 1.0.0
      const context = createMockContext({ 'x-frontend-version': '1.0.1' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should reject request when minor version is below', () => {
      // Set minimum to 1.2.0
      (configService.get as jest.Mock).mockReturnValue('1.2.0');

      // Frontend version 1.1.0 is below minimum 1.2.0
      const context = createMockContext({ 'x-frontend-version': '1.1.0' });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(426);
      }
    });
  });

  describe('Missing header handling', () => {
    it('should reject request when x-frontend-version header is missing', () => {
      const context = createMockContext({});

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(426);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.message).toContain('Frontend version header is required');
      }
    });

    it('should reject request when x-frontend-version header is undefined', () => {
      const context = createMockContext({ 'x-frontend-version': undefined });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(426);
      }
    });
  });

  describe('Invalid version format handling', () => {
    it('should reject request with invalid version format', () => {
      const context = createMockContext({ 'x-frontend-version': 'not-a-version' });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(426);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.message).toContain('Invalid frontend version format');
      }
    });

    it('should reject request with empty version string', () => {
      const context = createMockContext({ 'x-frontend-version': '' });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(426);
      }
    });

    it('should handle version with leading "v" prefix', () => {
      // semver.clean handles "v1.0.0" -> "1.0.0"
      const context = createMockContext({ 'x-frontend-version': 'v1.0.0' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should throw 500 when minimum version config is invalid', () => {
      (configService.get as jest.Mock).mockReturnValue('invalid-version');

      const context = createMockContext({ 'x-frontend-version': '1.0.0' });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect(error).toBeInstanceOf(HttpException);
        expect((error as HttpException).getStatus()).toBe(500);
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.message).toContain('Server configuration error');
      }
    });
  });

  describe('Logging behavior', () => {
    it('should log warning when version header is missing', () => {
      const context = createMockContext({});

      try {
        guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Missing x-frontend-version header'),
      );
    });

    it('should log warning when version is below minimum', () => {
      const context = createMockContext({ 'x-frontend-version': '0.9.0' });

      try {
        guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Frontend version 0.9.0 is below minimum 1.0.0'),
      );
    });

    it('should log warning with client IP when version is invalid', () => {
      const context = createMockContext({ 'x-frontend-version': 'garbage' });

      try {
        guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid frontend version format'),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('127.0.0.1'));
    });

    it('should log error when minimum version config is invalid', () => {
      (configService.get as jest.Mock).mockReturnValue('bad-config');

      const context = createMockContext({ 'x-frontend-version': '1.0.0' });

      try {
        guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid MINIMUM_SUPPORTED_FRONTEND_VERSION format'),
      );
    });

    it('should include x-forwarded-for IP in log when present', () => {
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'x-frontend-version': '0.5.0',
              'x-forwarded-for': '192.168.1.100',
            },
            ip: '127.0.0.1',
          }),
        }),
      } as unknown as ExecutionContext;

      try {
        guard.canActivate(context);
      } catch {
        // Expected to throw
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('192.168.1.100'));
    });

    it('should log "unknown" when both x-forwarded-for and ip are missing', () => {
      // Create context with no x-forwarded-for header and no ip property
      const context = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'x-frontend-version': '0.5.0',
            },
            // No ip property - will fallback to 'unknown'
          }),
        }),
      } as unknown as ExecutionContext;

      try {
        guard.canActivate(context);
      } catch {
        // Expected to throw (version below minimum)
      }

      expect(loggerWarnSpy).toHaveBeenCalledWith(expect.stringContaining('unknown'));
    });
  });

  describe('updateUrl in 426 responses', () => {
    const repoUrl = 'https://github.com/hashgraph/hedera-transaction-tool/releases/download';
    const latestVersion = '2.0.0';

    beforeEach(() => {
      // Mock config service to return different values based on key
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'MINIMUM_SUPPORTED_FRONTEND_VERSION':
            return '1.0.0';
          case 'FRONTEND_REPO_URL':
            return repoUrl;
          case 'LATEST_SUPPORTED_FRONTEND_VERSION':
            return latestVersion;
          default:
            return undefined;
        }
      });
    });

    it('should include updateUrl when version is below minimum', () => {
      const context = createMockContext({ 'x-frontend-version': '0.9.0' });

      try {
        guard.canActivate(context);
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.updateUrl).toBe(`${repoUrl}/v${latestVersion}/`);
      }
    });

    it('should include updateUrl when version header is missing', () => {
      const context = createMockContext({});

      try {
        guard.canActivate(context);
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.updateUrl).toBe(`${repoUrl}/v${latestVersion}/`);
      }
    });

    it('should include updateUrl when version format is invalid', () => {
      const context = createMockContext({ 'x-frontend-version': 'invalid' });

      try {
        guard.canActivate(context);
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.updateUrl).toBe(`${repoUrl}/v${latestVersion}/`);
      }
    });

    it('should return null updateUrl when FRONTEND_REPO_URL is missing', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'MINIMUM_SUPPORTED_FRONTEND_VERSION':
            return '1.0.0';
          case 'LATEST_SUPPORTED_FRONTEND_VERSION':
            return latestVersion;
          default:
            return undefined;
        }
      });

      const context = createMockContext({ 'x-frontend-version': '0.9.0' });

      try {
        guard.canActivate(context);
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.updateUrl).toBeNull();
      }
    });

    it('should return null updateUrl when LATEST_SUPPORTED_FRONTEND_VERSION is missing', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'MINIMUM_SUPPORTED_FRONTEND_VERSION':
            return '1.0.0';
          case 'FRONTEND_REPO_URL':
            return repoUrl;
          default:
            return undefined;
        }
      });

      const context = createMockContext({ 'x-frontend-version': '0.9.0' });

      try {
        guard.canActivate(context);
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.updateUrl).toBeNull();
      }
    });

    it('should return null updateUrl when LATEST_SUPPORTED_FRONTEND_VERSION is invalid', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'MINIMUM_SUPPORTED_FRONTEND_VERSION':
            return '1.0.0';
          case 'FRONTEND_REPO_URL':
            return repoUrl;
          case 'LATEST_SUPPORTED_FRONTEND_VERSION':
            return 'invalid-version';
          default:
            return undefined;
        }
      });

      const context = createMockContext({ 'x-frontend-version': '0.9.0' });

      try {
        guard.canActivate(context);
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.updateUrl).toBeNull();
      }
    });

    it('should strip trailing slashes from repo URL', () => {
      (configService.get as jest.Mock).mockImplementation((key: string) => {
        switch (key) {
          case 'MINIMUM_SUPPORTED_FRONTEND_VERSION':
            return '1.0.0';
          case 'FRONTEND_REPO_URL':
            return 'https://github.com/hashgraph/hedera-transaction-tool/releases/download///';
          case 'LATEST_SUPPORTED_FRONTEND_VERSION':
            return '2.0.0';
          default:
            return undefined;
        }
      });

      const context = createMockContext({ 'x-frontend-version': '0.9.0' });

      try {
        guard.canActivate(context);
      } catch (error) {
        const response = (error as HttpException).getResponse() as Record<string, unknown>;
        expect(response.updateUrl).toBe(
          'https://github.com/hashgraph/hedera-transaction-tool/releases/download/v2.0.0/',
        );
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle prerelease versions correctly', () => {
      // 1.0.0-alpha is less than 1.0.0
      const context = createMockContext({ 'x-frontend-version': '1.0.0-alpha' });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(426);
      }
    });

    it('should handle version with build metadata', () => {
      // 1.0.0+build is equal to 1.0.0 in semver
      const context = createMockContext({ 'x-frontend-version': '1.0.0+build.123' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('should handle major version upgrade', () => {
      (configService.get as jest.Mock).mockReturnValue('2.0.0');

      // Frontend 1.9.9 is below minimum 2.0.0
      const context = createMockContext({ 'x-frontend-version': '1.9.9' });

      expect(() => guard.canActivate(context)).toThrow(HttpException);

      try {
        guard.canActivate(context);
      } catch (error) {
        expect((error as HttpException).getStatus()).toBe(426);
      }
    });

    it('should allow higher major version', () => {
      // Frontend 3.0.0 is above minimum 1.0.0
      const context = createMockContext({ 'x-frontend-version': '3.0.0' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });
});
