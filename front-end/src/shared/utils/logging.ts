export const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface LogPayload {
  message: string;
  metadata?: unknown;
}

const REDACTED_VALUE = '[redacted]';
const CIRCULAR_VALUE = '[circular]';
const MAX_STRING_LENGTH = 256;
export const MAX_SERIALIZE_DEPTH = 5;

const SENSITIVE_KEY_MARKERS = [
  'password',
  'accesstoken',
  'refreshtoken',
  'jwt',
  'authorization',
  'cookie',
  'secret',
  'privatekey',
  'mnemonic',
  'recoveryphrase',
  'seed',
  'signaturebytes',
  'signatureraw',
  'signedtransaction',
  'signaturemap',
  'transactionbytes',
  'requestbody',
  'responsebody',
  'pem',
  'encrypted',
  'secrethash',
] as const;

const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const BEARER_PATTERN = /\bbearer\s+[^\s,;]+/gi;
const PEM_PATTERN = /-----BEGIN [^-]+-----[\s\S]*?-----END [^-]+-----/g;
const HEX_PAYLOAD_PATTERN = /^(?:0x)?[0-9a-f]{128,}$/i;
const BASE64_PAYLOAD_PATTERN = /^(?:[A-Za-z0-9+/=_-]{128,})$/;

export const isLogLevel = (value: string): value is LogLevel =>
  LOG_LEVELS.includes(value as LogLevel);

export function normalizeLogArguments(data: unknown[]): LogPayload {
  if (data.length === 0) {
    return { message: 'Log entry' };
  }

  const [first, ...rest] = data;

  if (typeof first === 'string') {
    return {
      message: first,
      metadata: rest.length === 0 ? undefined : rest.length === 1 ? rest[0] : rest,
    };
  }

  if (first instanceof Error) {
    return {
      message: first.message || first.name || 'Error',
      metadata: data.length === 1 ? first : data,
    };
  }

  return {
    message: 'Structured log',
    metadata: data.length === 1 ? first : data,
  };
}

export function sanitizeLogPayload(data: unknown[]): LogPayload {
  const { message, metadata } = normalizeLogArguments(data);

  return {
    message: sanitizeMessageText(message),
    metadata: metadata === undefined ? undefined : sanitizeLogValue(metadata),
  };
}

export function sanitizeMessageText(value: string): string {
  const scrubbed = scrubSensitiveString(value);

  if (scrubbed.length <= MAX_STRING_LENGTH) {
    return scrubbed;
  }

  return `${scrubbed.slice(0, MAX_STRING_LENGTH)}...[truncated ${scrubbed.length - MAX_STRING_LENGTH} chars]`;
}

export function sanitizeLogValue(
  value: unknown,
  options: {
    depth?: number;
    seen?: WeakSet<object>;
    key?: string;
  } = {},
): unknown {
  const { depth = 0, seen = new WeakSet<object>(), key } = options;

  if (key && isSensitiveKey(key)) {
    return REDACTED_VALUE;
  }

  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return summarizeStringValue(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'function') {
    return '[function]';
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return sanitizeError(value);
  }

  const bufferApi = globalThis as typeof globalThis & {
    Buffer?: {
      isBuffer?: (candidate: unknown) => boolean;
    };
  };

  if (bufferApi.Buffer?.isBuffer?.(value)) {
    return {
      type: 'Buffer',
      length: (value as { length?: number }).length ?? 0,
    };
  }

  if (value instanceof Uint8Array) {
    return {
      type: value.constructor.name,
      length: value.length,
    };
  }

  if (value instanceof ArrayBuffer) {
    return {
      type: 'ArrayBuffer',
      length: value.byteLength,
    };
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_SERIALIZE_DEPTH) {
      return {
        type: 'Array',
        length: value.length,
      };
    }

    return value.map(item =>
      sanitizeLogValue(item, {
        depth: depth + 1,
        seen,
      }),
    );
  }

  if (value instanceof Map) {
    if (depth >= MAX_SERIALIZE_DEPTH) {
      return {
        type: 'Map',
        size: value.size,
      };
    }

    return {
      type: 'Map',
      entries: Array.from(value.entries()).map(([entryKey, entryValue]) => [
        typeof entryKey === 'string' ? entryKey : sanitizeLogValue(entryKey, { depth: depth + 1, seen }),
        sanitizeLogValue(entryValue, {
          depth: depth + 1,
          seen,
          key: typeof entryKey === 'string' ? entryKey : undefined,
        }),
      ]),
    };
  }

  if (value instanceof Set) {
    if (depth >= MAX_SERIALIZE_DEPTH) {
      return {
        type: 'Set',
        size: value.size,
      };
    }

    return {
      type: 'Set',
      values: Array.from(value.values()).map(entry =>
        sanitizeLogValue(entry, {
          depth: depth + 1,
          seen,
        }),
      ),
    };
  }

  if (typeof value === 'object') {
    if (seen.has(value)) {
      return CIRCULAR_VALUE;
    }

    seen.add(value);

    if (depth >= MAX_SERIALIZE_DEPTH) {
      return {
        type: value.constructor?.name || 'Object',
      };
    }

    const result: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of Object.entries(value)) {
      result[entryKey] = sanitizeLogValue(entryValue, {
        depth: depth + 1,
        seen,
        key: entryKey,
      });
    }

    seen.delete(value);

    return Object.keys(result).length > 0
      ? result
      : { type: value.constructor?.name || 'Object' };
  }

  return String(value);
}

function sanitizeError(error: Error): Record<string, unknown> {
  return {
    name: sanitizeMessageText(error.name),
    message: sanitizeMessageText(error.message),
    code: 'code' in error ? sanitizeLogValue((error as Error & { code?: unknown }).code) : undefined,
    stack: error.stack ? sanitizeMessageText(error.stack) : undefined,
  };
}

function summarizeStringValue(value: string): unknown {
  const scrubbed = scrubSensitiveString(value);

  if (looksLikePayload(scrubbed)) {
    return {
      type: 'string',
      length: scrubbed.length,
      summary: 'payload omitted',
    };
  }

  if (scrubbed.length > MAX_STRING_LENGTH) {
    return {
      type: 'string',
      length: scrubbed.length,
      preview: scrubbed.slice(0, MAX_STRING_LENGTH),
    };
  }

  return scrubbed;
}

function scrubSensitiveString(value: string): string {
  return value
    .replace(PEM_PATTERN, REDACTED_VALUE)
    .replace(BEARER_PATTERN, 'bearer [redacted]')
    .replace(JWT_PATTERN, REDACTED_VALUE);
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');

  return SENSITIVE_KEY_MARKERS.some(marker => normalized.includes(marker));
}

function looksLikePayload(value: string): boolean {
  return HEX_PAYLOAD_PATTERN.test(value) || BASE64_PAYLOAD_PATTERN.test(value);
}
