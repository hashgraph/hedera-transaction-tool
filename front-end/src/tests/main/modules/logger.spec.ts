import { MockedClass, MockedObject } from 'vitest';

import setupLoggers, { getAppUpdateLogger, getDatabaseLogger } from '@main/modules/logger';

import { is } from '@electron-toolkit/utils';
import { BrowserWindow } from 'electron';
import logger, { MainLogger } from 'electron-log';

vi.mock('@electron-toolkit/utils', () => ({ is: { dev: true } }));
vi.mock('electron', () => {
  const bw = vi.fn() as unknown as MockedClass<typeof BrowserWindow>;

  Object.defineProperty(bw.prototype, 'webContents', {
    value: {
      send: vi.fn(),
    },
    writable: false,
    enumerable: true,
  });

  return {
    BrowserWindow: bw,
    ipcMain: {
      on: vi.fn(),
    },
  };
});
vi.mock('electron-log', () => ({
  default: {
    default: {
      errorHandler: {
        startCatching: vi.fn(),
      },
      transports: {
        file: {},
        console: {},
      },
      log: vi.fn(),
    },
    create: vi.fn().mockReturnValue({
      errorHandler: {
        startCatching: vi.fn(),
      },
      transports: {
        file: {},
        console: {},
      },
      log: vi.fn(),
    }),
  },
}));

describe('logger', () => {
  let originalConsoleLog: any;
  let originalConsoleInfo: any;
  let originalConsoleError: any;

  beforeEach(() => {
    originalConsoleLog = console.log;
    originalConsoleInfo = console.info;
    originalConsoleError = console.error;

    console.log = vi.fn();
    console.info = vi.fn();
    console.error = vi.fn();

    vi.clearAllMocks();
  });

  afterEach(() => {
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.error = originalConsoleError;
  });

  test('Should setup main, info and error loggers in dev', () => {
    setupLoggers();

    expect(logger.default.errorHandler.startCatching).toHaveBeenCalled();
    expect(logger.default.transports.file.fileName).toEqual(`main-dev.log`);
    expect(logger.default.transports.file.level).toEqual('debug');

    expect(logger.create).toHaveBeenCalledWith({ logId: 'info' });
    expect(logger.create).toHaveBeenCalledWith({ logId: 'error' });
  });

  test('Should setup main, info and error loggers in prod', () => {
    vi.mocked(is).dev = false;

    setupLoggers();

    expect(logger.default.errorHandler.startCatching).toHaveBeenCalled();
    expect(logger.default.transports.file.fileName).toEqual(`main.log`);
    expect(logger.default.transports.file.level).toEqual('debug');

    expect(logger.create).toHaveBeenCalledWith({ logId: 'info' });
    expect(logger.create).toHaveBeenCalledWith({ logId: 'error' });

    vi.mocked(is).dev = true;
  });

  test('Should setup update logger in dev', () => {
    setupLoggers();

    const updateLogger = getAppUpdateLogger();

    expect(logger.create).toHaveBeenCalledWith({ logId: 'appUpdate' });
    expect(updateLogger.transports.file.fileName).toEqual(`app-updates-dev.log`);
    expect(updateLogger.transports.file.level).toEqual('debug');
  });

  test('Should setup update logger in prod', () => {
    vi.mocked(is).dev = false;

    setupLoggers();

    const updateLogger = getAppUpdateLogger();

    expect(logger.create).toHaveBeenCalledWith({ logId: 'appUpdate' });
    expect(updateLogger.transports.file.fileName).toEqual(`app-updates.log`);
    expect(updateLogger.transports.file.level).toEqual('debug');

    vi.mocked(is).dev = true;
  });

  test('Should setup database logger in dev', () => {
    setupLoggers();

    const databaseLogger = getDatabaseLogger();

    expect(logger.create).toHaveBeenCalledWith({ logId: 'Database' });
    expect(databaseLogger.transports.file.fileName).toEqual(`database-dev.log`);
    expect(databaseLogger.transports.file.level).toEqual('debug');
  });

  test('Should setup database logger in prod', () => {
    vi.mocked(is).dev = false;

    setupLoggers();

    const databaseLogger = getDatabaseLogger();

    expect(logger.create).toHaveBeenCalledWith({ logId: 'Database' });
    expect(databaseLogger.transports.file.fileName).toEqual(`database.log`);
    expect(databaseLogger.transports.file.level).toEqual('debug');

    vi.mocked(is).dev = true;
  });

  test('Should log to correct loggers', () => {
    setupLoggers();

    const loggerMO = logger as unknown as MockedObject<
      MainLogger & {
        default: MainLogger;
      }
    >;

    console.log('test');
    expect(loggerMO.default.log).toHaveBeenCalledWith('test');
    expect(loggerMO.create.mock.results[0].value.log).toHaveBeenCalledWith('test');

    console.info('test');
    expect(loggerMO.create.mock.results[0].value.log).toHaveBeenCalledWith('test');

    console.error('test');
    expect(loggerMO.default.log).toHaveBeenCalledWith('test');
    expect(loggerMO.create.mock.results[1].value.log).toHaveBeenCalledWith('test');
  });
});
