import fs from 'fs';
import path from 'path';

import { app } from 'electron';
import electronLog from 'electron-log';
import { is } from '@electron-toolkit/utils';

import {
  isLogLevel,
  sanitizeLogPayload,
  type LogLevel,
} from '@shared/utils/logging';

const LOG_DIRECTORY_NAME = 'logs';
const LOG_FILE_NAME = 'app.log';
const LOG_MAX_SIZE_BYTES = 5 * 1024 * 1024;
const LOG_ARCHIVE_COUNT = 5;
const DEFAULT_LOG_LEVEL: LogLevel = 'info';
const MAX_IPC_MESSAGE_LENGTH = 10_000;
const MAX_IPC_COMPONENT_LENGTH = 100;

function resolveLogLevel(): LogLevel {
  const envLevel = process.env.HTT_LOG_LEVEL?.toLowerCase();
  if (envLevel && isLogLevel(envLevel)) {
    return envLevel;
  }
  return DEFAULT_LOG_LEVEL;
}

type RawLogger = typeof electronLog.default;

export interface FrontendLogger {
  debug: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
  info: (...data: unknown[]) => void;
  log: (...data: unknown[]) => void;
  warn: (...data: unknown[]) => void;
}

const rootLogger = electronLog.default;
const loggerCache = new Map<string, FrontendLogger>();
let loggerConfigured = false;
let consolePatched = false;

export default function initLogger() {
  configureRootLogger();
  patchMainConsole();
  startMainErrorCapture();
}

export function createLogger(component: string): FrontendLogger {
  configureRootLogger();

  const existing = loggerCache.get(component);
  if (existing) {
    return existing;
  }

  const instance: FrontendLogger = {
    debug: (...data: unknown[]) => writeLog('debug', component, data),
    error: (...data: unknown[]) => writeLog('error', component, data),
    info: (...data: unknown[]) => writeLog('info', component, data),
    log: (...data: unknown[]) => writeLog('info', component, data),
    warn: (...data: unknown[]) => writeLog('warn', component, data),
  };

  loggerCache.set(component, instance);
  return instance;
}

export function getAppUpdateLogger(): FrontendLogger {
  return createLogger('main.updater');
}

export function getDatabaseLogger(): FrontendLogger {
  return createLogger('main.database');
}

export function getLogsDirectoryPath() {
  return path.join(app.getPath('userData'), LOG_DIRECTORY_NAME);
}

export function getLogFilePath() {
  return path.join(getLogsDirectoryPath(), LOG_FILE_NAME);
}

export function getLoggerSettings() {
  return {
    archiveCount: LOG_ARCHIVE_COUNT,
    directory: getLogsDirectoryPath(),
    fileName: LOG_FILE_NAME,
    level: resolveLogLevel(),
    maxSizeBytes: LOG_MAX_SIZE_BYTES,
  };
}

export function logRendererMessage(
  level: LogLevel,
  component: string,
  message: string,
  metadata?: unknown,
) {
  try {
    const validLevel = isLogLevel(level) ? level : 'info';

    const rawComponent = typeof component === 'string' && component.trim().length > 0
      ? component.trim().slice(0, MAX_IPC_COMPONENT_LENGTH)
      : 'unknown';
    const normalizedComponent = rawComponent.startsWith('renderer.')
      ? rawComponent
      : `renderer.${rawComponent}`;

    const validMessage = String(message).slice(0, MAX_IPC_MESSAGE_LENGTH);

    writeLog(validLevel, normalizedComponent, metadata === undefined ? [validMessage] : [validMessage, metadata], {
      processType: 'renderer',
    });
  } catch {
    /* Malformed IPC payload must not crash the logger */
  }
}

function configureRootLogger() {
  if (loggerConfigured) {
    return;
  }

  ensureLogsDirectory();

  rootLogger.hooks = [sanitizeHook];
  rootLogger.transports.file.fileName = LOG_FILE_NAME;
  rootLogger.transports.file.level = resolveLogLevel();
  rootLogger.transports.file.maxSize = LOG_MAX_SIZE_BYTES;
  rootLogger.transports.file.resolvePathFn = () => getLogFilePath();
  rootLogger.transports.file.archiveLogFn = file => rotateLogFiles(file.toString());
  rootLogger.transports.file.format = ({ message }) => [serializeLogEntry(message)];

  rootLogger.transports.console.level = is.dev ? resolveLogLevel() : false;
  rootLogger.transports.console.format = ({ message }) => {
    const [text, metadata] = message.data;
    const component = getComponentName(message.logId, message.variables?.processType);

    return metadata === undefined
      ? [`[${component}] ${String(text)}`]
      : [`[${component}] ${String(text)}`, metadata];
  };

  rootLogger.transports.ipc.level = false;
  rootLogger.transports.remote.level = false;

  loggerConfigured = true;
}

function writeLog(
  level: LogLevel,
  component: string,
  data: unknown[],
  variables?: {
    processType?: string;
    [key: string]: unknown;
  },
) {
  rootLogger.processMessage({
    data,
    level,
    logId: component,
    variables: variables
      ? {
          processType: variables.processType || 'browser',
          ...variables,
        }
      : undefined,
  });
}

function sanitizeHook(message: Parameters<RawLogger['processMessage']>[0]) {
  const payload = sanitizeLogPayload(message.data || []);
  const component = getComponentName(message.logId, message.variables?.processType);

  return {
    ...message,
    data: payload.metadata === undefined ? [payload.message] : [payload.message, payload.metadata],
    logId: component,
    scope: component,
  };
}

function serializeLogEntry(message: Parameters<RawLogger['processMessage']>[0]) {
  const [text, metadata] = message.data || [];

  return JSON.stringify({
    timestamp: (message.date || new Date()).toISOString(),
    level: isLogLevel(message.level) ? message.level : DEFAULT_LOG_LEVEL,
    component: getComponentName(message.logId, message.variables?.processType),
    message: typeof text === 'string' ? text : 'Structured log',
    ...(metadata === undefined ? {} : { metadata }),
  });
}

function getComponentName(logId?: string, processType?: unknown) {
  if (logId && logId.trim().length > 0) {
    return logId;
  }

  if (processType === 'renderer') {
    return 'renderer.unknown';
  }

  return 'main.unknown';
}

function patchMainConsole() {
  if (consolePatched) {
    return;
  }

  const consoleLogger = createLogger('main.console');

  console.log = (...data: unknown[]) => {
    consoleLogger.info(...data);
  };
  console.info = (...data: unknown[]) => {
    consoleLogger.info(...data);
  };
  console.warn = (...data: unknown[]) => {
    consoleLogger.warn(...data);
  };
  console.error = (...data: unknown[]) => {
    consoleLogger.error(...data);
  };
  console.debug = (...data: unknown[]) => {
    consoleLogger.debug(...data);
  };

  consolePatched = true;
}

function startMainErrorCapture() {
  rootLogger.errorHandler.startCatching({
    showDialog: false,
    onError: ({ error, errorName, processType }) => {
      writeLog('error', 'main.unhandled', [
        errorName || 'Unhandled error',
        {
          error,
          processType,
        },
      ]);

      return false;
    },
  });
}

function ensureLogsDirectory() {
  fs.mkdirSync(getLogsDirectoryPath(), { recursive: true });
}

function rotateLogFiles(currentPath: string) {
  const parsedPath = path.parse(currentPath);

  for (let index = LOG_ARCHIVE_COUNT; index >= 1; index--) {
    const sourcePath =
      index === 1
        ? currentPath
        : path.join(parsedPath.dir, `${parsedPath.name}.${index - 1}${parsedPath.ext}`);
    const targetPath = path.join(parsedPath.dir, `${parsedPath.name}.${index}${parsedPath.ext}`);

    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    fs.rmSync(targetPath, { force: true });
    fs.renameSync(sourcePath, targetPath);
  }
}
