import {
  MAX_SERIALIZE_DEPTH,
  normalizeLogArguments,
  sanitizeLogPayload,
  type LogLevel,
} from '@shared/utils/logging';

type ConsoleMethod = (...data: unknown[]) => void;

const nativeConsole: Record<'debug' | 'error' | 'info' | 'log' | 'warn', ConsoleMethod> = {
  debug: console.debug.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  log: console.log.bind(console),
  warn: console.warn.bind(console),
};

let rendererLoggingSetup = false;

const loggerCache = new Map<string, RendererLogger>();

export interface RendererLogger {
  debug: (...data: unknown[]) => void;
  error: (...data: unknown[]) => void;
  info: (...data: unknown[]) => void;
  log: (...data: unknown[]) => void;
  warn: (...data: unknown[]) => void;
}

export function createLogger(component: string): RendererLogger {
  const cached = loggerCache.get(component);
  if (cached) {
    return cached;
  }

  const logger: RendererLogger = {
    debug: (...data: unknown[]) => forwardLog('debug', component, data),
    error: (...data: unknown[]) => forwardLog('error', component, data),
    info: (...data: unknown[]) => forwardLog('info', component, data),
    log: (...data: unknown[]) => forwardLog('info', component, data),
    warn: (...data: unknown[]) => forwardLog('warn', component, data),
  };

  loggerCache.set(component, logger);
  return logger;
}

export function setupRendererLogging() {
  if (rendererLoggingSetup) {
    return;
  }

  const consoleLogger = createLogger('renderer.console');
  const windowLogger = createLogger('renderer.window');

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

  window.addEventListener('error', event => {
    windowLogger.error('Unhandled window error', {
      colno: event.colno,
      error: serializeForIPC(event.error),
      filename: event.filename,
      lineno: event.lineno,
      message: event.message,
    });
  });

  window.addEventListener('unhandledrejection', event => {
    windowLogger.error('Unhandled promise rejection', {
      reason: serializeForIPC(event.reason),
    });
  });

  rendererLoggingSetup = true;
}

function forwardLog(level: LogLevel, component: string, data: unknown[]) {
  const { message, metadata } = normalizeLogArguments(data);
  const serializedMetadata = metadata === undefined ? undefined : serializeForIPC(metadata);

  window.electronAPI?.local?.logging?.log(level, component, message, serializedMetadata)?.catch(error => {
    nativeConsole.error('Failed to forward renderer log', serializeForIPC(error));
  });

  if (import.meta.env.DEV) {
    const sanitized = sanitizeLogPayload(metadata === undefined ? [message] : [message, metadata]);
    const consoleMethod = mapLevelToConsole(level);

    if (sanitized.metadata === undefined) {
      consoleMethod(`[${component}] ${sanitized.message}`);
    } else {
      consoleMethod(`[${component}] ${sanitized.message}`, sanitized.metadata);
    }
  }
}

function mapLevelToConsole(level: LogLevel): ConsoleMethod {
  switch (level) {
    case 'debug':
      return nativeConsole.debug;
    case 'error':
      return nativeConsole.error;
    case 'warn':
      return nativeConsole.warn;
    default:
      return nativeConsole.info;
  }
}

export function serializeForIPC(
  value: unknown,
  options: {
    depth?: number;
    seen?: WeakSet<object>;
  } = {},
): unknown {
  const { depth = 0, seen = new WeakSet<object>() } = options;

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return {
      code: 'code' in value
        ? serializeForIPC((value as Error & { code?: unknown }).code, { depth: depth + 1, seen })
        : undefined,
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (value instanceof Uint8Array) {
    return {
      length: value.length,
      type: value.constructor.name,
    };
  }

  if (value instanceof ArrayBuffer) {
    return {
      length: value.byteLength,
      type: 'ArrayBuffer',
    };
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_SERIALIZE_DEPTH) {
      return {
        length: value.length,
        type: 'Array',
      };
    }

    return value.map(item => serializeForIPC(item, { depth: depth + 1, seen }));
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return '[circular]';
    }

    seen.add(value);

    if (depth >= MAX_SERIALIZE_DEPTH) {
      return {
        type: value.constructor?.name || 'Object',
      };
    }

    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = serializeForIPC(entryValue, { depth: depth + 1, seen });
    }
    seen.delete(value);
    return result;
  }

  return String(value);
}
