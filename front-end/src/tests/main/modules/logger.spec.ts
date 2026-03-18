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

  test('createLogger returns cached instance for the same component', () => {
    const first = createLogger('main.cache-test');
    const second = createLogger('main.cache-test');

    expect(first).toBe(second);
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

  test('rotateLogFiles removes and renames archive slots', async () => {
    initLogger();

    const fsMock = (await import('fs')).default;
    fsMock.existsSync.mockReturnValue(true);

    rootLogger.transports.file.archiveLogFn('/mock-user-data/logs/app.log');

    expect(fsMock.rmSync).toHaveBeenCalled();
    expect(fsMock.renameSync).toHaveBeenCalled();

    // There are 5 archive slots, so we expect 5 rm + 5 rename calls
    expect(fsMock.rmSync).toHaveBeenCalledTimes(5);
    expect(fsMock.renameSync).toHaveBeenCalledTimes(5);

    fsMock.existsSync.mockReturnValue(false);
    fsMock.rmSync.mockClear();
    fsMock.renameSync.mockClear();
  });

  test('rotateLogFiles skips slots where source file does not exist', async () => {
    initLogger();

    const fsMock = (await import('fs')).default;
    // Only the current file exists; archived slots do not
    fsMock.existsSync.mockImplementation((p: string) => p === '/mock-user-data/logs/app.log');
    fsMock.rmSync.mockClear();
    fsMock.renameSync.mockClear();

    rootLogger.transports.file.archiveLogFn('/mock-user-data/logs/app.log');

    // Only slot 1 (source = current file) should be renamed
    expect(fsMock.renameSync).toHaveBeenCalledTimes(1);
    expect(fsMock.rmSync).toHaveBeenCalledTimes(1);

    fsMock.existsSync.mockReturnValue(false);
    fsMock.rmSync.mockClear();
    fsMock.renameSync.mockClear();
  });

  test('ensureLogsDirectory creates the logs directory', async () => {
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
      const rl = {
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
      return { default: { default: rl } };
    });

    const freshModule = await import('@main/modules/logger');
    const freshFs = (await import('fs')).default;

    freshModule.default();

    expect(freshFs.mkdirSync).toHaveBeenCalledWith('/mock-user-data/logs', { recursive: true });
  });

  test('patchMainConsole routes console.log through processMessage', () => {
    initLogger();
    rootLogger.processMessage.mockClear();

    console.log('test from console');

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'main.console',
      }),
    );
  });

  test('patchMainConsole routes console.info, warn, error, debug through processMessage', () => {
    initLogger();
    rootLogger.processMessage.mockClear();

    console.info('info msg');
    console.warn('warn msg');
    console.error('error msg');
    console.debug('debug msg');

    expect(rootLogger.processMessage).toHaveBeenCalledTimes(4);
    expect(rootLogger.processMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: ['info msg'], level: 'info', logId: 'main.console' }),
    );
    expect(rootLogger.processMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: ['warn msg'], level: 'warn', logId: 'main.console' }),
    );
    expect(rootLogger.processMessage).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ data: ['error msg'], level: 'error', logId: 'main.console' }),
    );
    expect(rootLogger.processMessage).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ data: ['debug msg'], level: 'debug', logId: 'main.console' }),
    );
  });

  test('startMainErrorCapture onError callback writes unhandled error log', () => {
    initLogger();
    rootLogger.processMessage.mockClear();

    const onError = rootLogger.errorHandler.startCatching.mock.calls[0][0].onError;
    const result = onError({
      error: new Error('boom'),
      errorName: 'TestError',
      processType: 'browser',
    });

    expect(result).toBe(false);
    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: ['TestError', { error: expect.any(Error), processType: 'browser' }],
        level: 'error',
        logId: 'main.unhandled',
      }),
    );
  });

  test('startMainErrorCapture onError falls back to Unhandled error when errorName is empty', () => {
    initLogger();
    rootLogger.processMessage.mockClear();

    const onError = rootLogger.errorHandler.startCatching.mock.calls[0][0].onError;
    onError({ error: new Error('boom'), errorName: '', processType: 'browser' });

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        data: ['Unhandled error', expect.anything()],
      }),
    );
  });

  test('serializeLogEntry handles missing date', () => {
    initLogger();

    const result = rootLogger.transports.file.format({
      message: { data: ['hello'], level: 'info', logId: 'test', variables: {} },
    });

    const parsed = JSON.parse(result[0]);
    expect(parsed.timestamp).toBeTruthy();
    expect(typeof parsed.timestamp).toBe('string');
    expect(parsed.message).toBe('hello');
  });

  test('serializeLogEntry falls back on invalid level', () => {
    initLogger();

    const result = rootLogger.transports.file.format({
      message: { data: ['msg'], level: 'invalid-level', logId: 'test', variables: {}, date: new Date('2026-01-01T00:00:00.000Z') },
    });

    const parsed = JSON.parse(result[0]);
    expect(parsed.level).toBe('info');
  });

  test('serializeLogEntry falls back to Structured log for non-string text', () => {
    initLogger();

    const result = rootLogger.transports.file.format({
      message: { data: [{ complex: true }], level: 'info', logId: 'test', variables: {}, date: new Date('2026-01-01T00:00:00.000Z') },
    });

    const parsed = JSON.parse(result[0]);
    expect(parsed.message).toBe('Structured log');
  });

  test('serializeLogEntry omits metadata key when metadata is absent', () => {
    initLogger();

    const result = rootLogger.transports.file.format({
      message: { data: ['just a message'], level: 'info', logId: 'test', variables: {}, date: new Date('2026-01-01T00:00:00.000Z') },
    });

    const parsed = JSON.parse(result[0]);
    expect(parsed).not.toHaveProperty('metadata');
  });

  test('console format uses logId as component name', () => {
    initLogger();

    const result = rootLogger.transports.console.format({
      message: { data: ['text'], logId: 'main.ipc', variables: {} },
    });

    expect(result[0]).toContain('[main.ipc]');
  });

  test('console format falls back to renderer.unknown for empty logId with renderer processType', () => {
    initLogger();

    const result = rootLogger.transports.console.format({
      message: { data: ['text'], logId: '', variables: { processType: 'renderer' } },
    });

    expect(result[0]).toContain('[renderer.unknown]');
  });

  test('console format falls back to main.unknown for empty logId without processType', () => {
    initLogger();

    const result = rootLogger.transports.console.format({
      message: { data: ['text'], logId: '', variables: {} },
    });

    expect(result[0]).toContain('[main.unknown]');
  });

  test('console format includes metadata when present', () => {
    initLogger();

    const result = rootLogger.transports.console.format({
      message: { data: ['text', { key: 'value' }], logId: 'main.test', variables: {} },
    });

    expect(result[0]).toContain('[main.test]');
    expect(result[1]).toEqual({ key: 'value' });
  });

  test('logRendererMessage swallows errors from malformed input', () => {
    // Force processMessage to throw to exercise the catch block
    rootLogger.processMessage.mockImplementationOnce(() => {
      throw new Error('unexpected');
    });

    expect(() => logRendererMessage('info', 'test', 'msg')).not.toThrow();
  });

  test('logRendererMessage uses renderer.unknown for empty component', () => {
    rootLogger.processMessage.mockClear();

    logRendererMessage('info', '', 'test message');

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'renderer.unknown',
      }),
    );
  });

  test('logRendererMessage truncates component longer than 100 chars', () => {
    rootLogger.processMessage.mockClear();

    const longComponent = 'a'.repeat(150);
    logRendererMessage('info', longComponent, 'test message');

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: expect.stringMatching(/^renderer\./),
      }),
    );

    const actualLogId = rootLogger.processMessage.mock.calls[0][0].logId;
    // 'renderer.' prefix is 9 chars, component is truncated to 100 chars
    expect(actualLogId.length).toBeLessThanOrEqual(9 + 100);
  });

  test('logRendererMessage truncates message longer than 10000 chars', () => {
    rootLogger.processMessage.mockClear();

    const longMessage = 'b'.repeat(15_000);
    logRendererMessage('info', 'test', longMessage);

    const actualData = rootLogger.processMessage.mock.calls[0][0].data;
    expect(actualData[0].length).toBeLessThanOrEqual(10_000);
  });

  test('logRendererMessage does not double prefix renderer.* component', () => {
    rootLogger.processMessage.mockClear();

    logRendererMessage('info', 'renderer.mycomp', 'test message');

    expect(rootLogger.processMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        logId: 'renderer.mycomp',
      }),
    );
  });

  test('logRendererMessage data array has only message when metadata is undefined', () => {
    rootLogger.processMessage.mockClear();

    logRendererMessage('info', 'comp', 'hello');

    const actualData = rootLogger.processMessage.mock.calls[0][0].data;
    expect(actualData).toEqual(['hello']);
  });

  test('configureRootLogger is idempotent - hooks array still has exactly 1 entry', () => {
    initLogger();
    initLogger();

    expect(rootLogger.hooks).toHaveLength(1);
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
