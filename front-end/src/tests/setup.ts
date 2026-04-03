/**
 * Global test setup — mocks the logger module so that tests importing
 * production code that calls `createLogger` at module scope do not
 * trigger Electron's `app.getPath()` (which is unavailable in the
 * test environment).
 */

const noopLogger = {
  debug: () => {},
  error: () => {},
  info: () => {},
  log: () => {},
  warn: () => {},
};

vi.mock('@main/modules/logger', () => ({
  default: vi.fn(),
  createLogger: () => noopLogger,
  getAppUpdateLogger: () => noopLogger,
  getDatabaseLogger: () => noopLogger,
  getLogsDirectoryPath: () => '/tmp/test-logs',
  getLogFilePath: () => '/tmp/test-logs/app.log',
  getLoggerSettings: () => ({
    archiveCount: 5,
    directory: '/tmp/test-logs',
    fileName: 'app.log',
    level: 'info',
    maxSizeBytes: 5 * 1024 * 1024,
  }),
  logRendererMessage: vi.fn(),
}));

vi.mock('@renderer/utils/logger', () => ({
  createLogger: () => noopLogger,
}));
