vi.unmock('@renderer/utils/logger');

const mockLog = vi.fn().mockResolvedValue(undefined);
const originalConsole = {
  debug: console.debug,
  error: console.error,
  info: console.info,
  log: console.log,
  warn: console.warn,
};

const loggerModule = await import('@renderer/utils/logger');
const { createLogger, setupRendererLogging, serializeForIPC } = loggerModule;

describe('renderer logger', () => {
  beforeEach(() => {
    mockLog.mockClear();

    window.electronAPI = {
      local: {
        logging: {
          log: mockLog,
        },
      },
    } as typeof window.electronAPI;
  });

  afterEach(() => {
    console.debug = originalConsole.debug;
    console.error = originalConsole.error;
    console.info = originalConsole.info;
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
  });

  test('forwards structured renderer logs through preload', async () => {
    const logger = createLogger('renderer.test');

    logger.error('Renderer failed', {
      reason: 'boom',
    });

    await Promise.resolve();

    expect(mockLog).toHaveBeenCalledWith('error', 'renderer.test', 'Renderer failed', {
      reason: 'boom',
    });
  });

  test('patches console methods to use the renderer bridge', async () => {
    setupRendererLogging();

    console.warn('Patched console warning', {
      token: 'secret-token',
    });

    await Promise.resolve();

    expect(mockLog).toHaveBeenCalledWith('warn', 'renderer.console', 'Patched console warning', {
      token: 'secret-token',
    });
  });

  test('window error event logs via renderer.window component', async () => {
    setupRendererLogging();

    const errorEvent = new ErrorEvent('error', {
      message: 'Test error',
      filename: 'test.js',
      lineno: 42,
      colno: 10,
      error: new Error('Test error'),
    });
    window.dispatchEvent(errorEvent);

    await Promise.resolve();

    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'renderer.window',
      'Unhandled window error',
      expect.objectContaining({
        message: 'Test error',
        filename: 'test.js',
        lineno: 42,
        colno: 10,
      }),
    );
  });

  test('unhandledrejection event logs the rejection reason', async () => {
    setupRendererLogging();

    // PromiseRejectionEvent may not exist in jsdom; construct manually
    const rejectionEvent = new Event('unhandledrejection') as any;
    rejectionEvent.reason = 'Something went wrong';
    rejectionEvent.promise = Promise.resolve();
    window.dispatchEvent(rejectionEvent);

    await Promise.resolve();

    expect(mockLog).toHaveBeenCalledWith(
      'error',
      'renderer.window',
      'Unhandled promise rejection',
      expect.objectContaining({
        reason: 'Something went wrong',
      }),
    );
  });

  test('IPC failure does not throw and logs gracefully', async () => {
    mockLog.mockRejectedValueOnce(new Error('IPC failed'));

    const logger = createLogger('renderer.fallback');

    // Should not throw even when IPC rejects
    expect(() => logger.info('This will fail')).not.toThrow();

    // Let the async rejection handler settle
    await new Promise(resolve => setTimeout(resolve, 50));

    // The fire-and-forget catch prevents unhandled rejection — if we got here, it worked
    expect(mockLog).toHaveBeenCalledWith('info', 'renderer.fallback', 'This will fail', undefined);
  });

  test('returns cached logger for same component name', () => {
    const logger1 = createLogger('renderer.cached');
    const logger2 = createLogger('renderer.cached');
    expect(logger1).toBe(logger2);
  });

  test('returns different loggers for different component names', () => {
    const logger1 = createLogger('renderer.a');
    const logger2 = createLogger('renderer.b');
    expect(logger1).not.toBe(logger2);
  });
});

describe('serializeForIPC', () => {
  test('passes primitives through unchanged', () => {
    expect(serializeForIPC('hello')).toBe('hello');
    expect(serializeForIPC(42)).toBe(42);
    expect(serializeForIPC(true)).toBe(true);
    expect(serializeForIPC(null)).toBe(null);
    expect(serializeForIPC(undefined)).toBe(undefined);
  });

  test('converts BigInt to string', () => {
    expect(serializeForIPC(BigInt(9007199254740991))).toBe('9007199254740991');
  });

  test('converts Date to ISO string', () => {
    const date = new Date('2025-01-15T10:30:00.000Z');
    expect(serializeForIPC(date)).toBe('2025-01-15T10:30:00.000Z');
  });

  test('serializes Error to structured object', () => {
    const error = new Error('test error');
    error.name = 'TestError';
    const result = serializeForIPC(error) as Record<string, unknown>;

    expect(result.name).toBe('TestError');
    expect(result.message).toBe('test error');
    expect(result).toHaveProperty('stack');
  });

  test('serializes Error with code property', () => {
    const error = new Error('ENOENT') as Error & { code: string };
    error.code = 'ENOENT';
    const result = serializeForIPC(error) as Record<string, unknown>;

    expect(result.code).toBe('ENOENT');
  });

  test('summarizes Uint8Array as { type, length }', () => {
    const arr = new Uint8Array([1, 2, 3]);
    const result = serializeForIPC(arr) as { type: string; length: number };

    expect(result.type).toBe('Uint8Array');
    expect(result.length).toBe(3);
  });

  test('summarizes ArrayBuffer as { type, length }', () => {
    const buf = new ArrayBuffer(16);
    const result = serializeForIPC(buf) as { type: string; length: number };

    expect(result.type).toBe('ArrayBuffer');
    expect(result.length).toBe(16);
  });

  test('detects circular references', () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;

    const result = serializeForIPC(obj) as Record<string, unknown>;
    expect(result.a).toBe(1);
    expect(result.self).toBe('[circular]');
  });

  test('summarizes deep nesting beyond depth 5', () => {
    let nested: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 6; i++) {
      nested = { child: nested };
    }

    const result = serializeForIPC(nested) as Record<string, unknown>;
    let current = result;
    for (let i = 0; i < 5; i++) {
      current = current.child as Record<string, unknown>;
    }
    expect(current).toEqual({ type: 'Object' });
  });

  test('serializes arrays recursively', () => {
    const result = serializeForIPC([1, 'two', true]);
    expect(result).toEqual([1, 'two', true]);
  });

  test('converts non-serializable values to string', () => {
    const sym = Symbol('test');
    expect(serializeForIPC(sym)).toBe('Symbol(test)');
  });
});
