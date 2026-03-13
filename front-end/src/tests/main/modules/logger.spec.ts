vi.unmock('@main/modules/logger');
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/mock-user-data'),
  },
}));
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    renameSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));
vi.mock('electron-log', () => {
  const processMessage = vi.fn();
  const startCatching = vi.fn();
  const rootLogger = {
    errorHandler: {
      startCatching,
    },
    hooks: [] as Array<(message: any) => any>,
    processMessage,
    transports: {
      console: {
        format: '',
        level: 'silly',
      },
      file: {
        archiveLogFn: vi.fn(),
        fileName: '',
        format: '',
        level: 'silly',
        maxSize: 0,
        resolvePathFn: vi.fn(),
      },
      ipc: {
        level: 'silly',
      },
      remote: {
        level: 'silly',
      },
    },
  };

  return {
    default: {
      default: rootLogger,
    },
  };
});

const loggerModule = await import('@main/modules/logger');
const electronLog = await import('electron-log');

const {
  default: initLogger,
  createLogger,
  getAppUpdateLogger,
  getDatabaseLogger,
  getLogFilePath,
  getLoggerSettings,
  logRendererMessage,
} = loggerModule;
const rootLogger = electronLog.default.default;

describe('logger', () => {
  beforeEach(() => {
    rootLogger.processMessage.mockClear();
    rootLogger.errorHandler.startCatching.mockClear();
  });

  test('configures the single file transport', () => {
    initLogger();

    expect(getLoggerSettings()).toEqual({
      archiveCount: 5,
      directory: '/mock-user-data/logs',
      fileName: 'app.log',
      level: 'info',
      maxSizeBytes: 5 * 1024 * 1024,
    });
    expect(getLogFilePath()).toBe('/mock-user-data/logs/app.log');
    expect(rootLogger.transports.file.fileName).toBe('app.log');
    expect(rootLogger.transports.file.maxSize).toBe(5 * 1024 * 1024);
    expect(rootLogger.transports.file.resolvePathFn()).toBe('/mock-user-data/logs/app.log');
    expect(rootLogger.transports.console.level).toBeTruthy();
    expect(rootLogger.transports.ipc.level).toBe(false);
    expect(rootLogger.transports.remote.level).toBe(false);
    expect(rootLogger.errorHandler.startCatching).toHaveBeenCalledWith(
      expect.objectContaining({
        showDialog: false,
      }),
    );
  });

  test('sanitizes sensitive metadata before formatting', () => {
    initLogger();

    const sanitizeHook = rootLogger.hooks[0];
    const sanitized = sanitizeHook({
      data: [
        'Renderer log',
        {
          jwtToken: 'secret-token',
          transactionBytes: 'a'.repeat(160),
        },
      ],
      date: new Date('2026-03-13T10:00:00.000Z'),
      level: 'info',
      logId: 'renderer.test',
      variables: {
        processType: 'renderer',
      },
    });

    const formatted = rootLogger.transports.file.format({
      data: sanitized.data,
      level: sanitized.level,
      logger: rootLogger,
      message: sanitized,
      transport: rootLogger.transports.file,
    })[0];

    expect(formatted).toContain('"component":"renderer.test"');
    expect(formatted).toContain('"jwtToken":"[redacted]"');
    expect(formatted).toContain('"transactionBytes":"[redacted]"');
    expect(formatted).not.toContain('secret-token');
  });

  test('writes component tagged messages through createLogger', () => {
    createLogger('renderer.websocket').warn('Socket disconnected', {
      reason: 'transport close',
    });

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: ['Socket disconnected', { reason: 'transport close' }],
        level: 'warn',
        logId: 'renderer.websocket',
      }),
    );
  });

  test('uses fixed component names for updater and database loggers', () => {
    getAppUpdateLogger().info('Checking for update');
    getDatabaseLogger().error('Database failed');

    expect(rootLogger.processMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: ['Checking for update'],
        level: 'info',
        logId: 'main.updater',
      }),
    );
    expect(rootLogger.processMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: ['Database failed'],
        level: 'error',
        logId: 'main.database',
      }),
    );
  });

  test('prefixes renderer log components and preserves renderer process type', () => {
    logRendererMessage('error', 'ipc', 'Renderer failure', { token: 'secret' });

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: ['Renderer failure', { token: 'secret' }],
        level: 'error',
        logId: 'renderer.ipc',
        variables: expect.objectContaining({
          processType: 'renderer',
        }),
      }),
    );
  });

  test('IPC validation: invalid log level defaults to info', () => {
    logRendererMessage('trace' as any, 'test', 'Message');

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'info',
        logId: 'renderer.test',
      }),
    );
  });

  test('IPC validation: non-string message is coerced', () => {
    logRendererMessage('info', 'test', 12345 as any);

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: ['12345'],
        logId: 'renderer.test',
      }),
    );
  });

  test('log level configuration via HTT_LOG_LEVEL env var', async () => {
    // This test needs a fresh module import to pick up env changes
    // Since the logger is already configured in this test suite,
    // we verify the resolveLogLevel behavior through getLoggerSettings
    const originalEnv = process.env.HTT_LOG_LEVEL;

    try {
      process.env.HTT_LOG_LEVEL = 'debug';

      // Re-import to get fresh module state
      vi.resetModules();
      vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
      vi.mock('electron', () => ({
        app: { getPath: vi.fn(() => '/mock-user-data') },
      }));
      vi.mock('fs', () => ({
        default: {
          existsSync: vi.fn(() => false),
          mkdirSync: vi.fn(),
          renameSync: vi.fn(),
          rmSync: vi.fn(),
        },
      }));
      vi.mock('electron-log', () => {
        const rootLogger = {
          errorHandler: { startCatching: vi.fn() },
          hooks: [] as any[],
          processMessage: vi.fn(),
          transports: {
            console: { format: '', level: 'silly' },
            file: {
              archiveLogFn: vi.fn(),
              fileName: '',
              format: '',
              level: 'silly',
              maxSize: 0,
              resolvePathFn: vi.fn(),
            },
            ipc: { level: 'silly' },
            remote: { level: 'silly' },
          },
        };
        return { default: { default: rootLogger } };
      });

      const freshModule = await import('@main/modules/logger');
      const settings = freshModule.getLoggerSettings();
      expect(settings.level).toBe('debug');
    } finally {
      if (originalEnv === undefined) {
        delete process.env.HTT_LOG_LEVEL;
      } else {
        process.env.HTT_LOG_LEVEL = originalEnv;
      }
    }
  });
});
