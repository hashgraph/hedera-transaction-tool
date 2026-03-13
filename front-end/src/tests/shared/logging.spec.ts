import {
  isLogLevel,
  normalizeLogArguments,
  sanitizeLogPayload,
  sanitizeLogValue,
} from '@shared/utils/logging';

describe('shared logging utils', () => {
  describe('sanitizeLogPayload', () => {
    test('redacts sensitive keys recursively', () => {
      const payload = sanitizeLogPayload([
        'Sensitive log',
        {
          jwtToken: 'secret-token',
          nested: {
            password: 'hunter2',
          },
        },
      ]);

      expect(payload.metadata).toEqual({
        jwtToken: '[redacted]',
        nested: {
          password: '[redacted]',
        },
      });
    });

    test('summarizes long payload strings instead of logging raw contents', () => {
      const payload = sanitizeLogPayload([
        'Payload log',
        {
          data: 'a'.repeat(256),
        },
      ]);

      expect(payload.metadata).toEqual({
        data: {
          type: 'string',
          length: 256,
          summary: 'payload omitted',
        },
      });
    });

    test('scrubs JWT tokens from message text', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abc123_signature';
      const payload = sanitizeLogPayload([`Login succeeded with token ${jwt}`]);

      expect(payload.message).not.toContain('eyJ');
      expect(payload.message).toContain('[redacted]');
    });

    test('scrubs Bearer tokens from message text', () => {
      const payload = sanitizeLogPayload(['Auth header: bearer my-secret-access-token']);

      expect(payload.message).not.toContain('my-secret-access-token');
      expect(payload.message).toContain('bearer [redacted]');
    });

    test('scrubs PEM blocks from message text', () => {
      const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJ\n-----END RSA PRIVATE KEY-----';
      const payload = sanitizeLogPayload([`Key loaded: ${pem}`]);

      expect(payload.message).not.toContain('MIIBogIBAAJ');
      expect(payload.message).toContain('[redacted]');
    });
  });

  describe('sanitizeLogValue', () => {
    test('detects circular references and returns [circular]', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj;

      const result = sanitizeLogValue(obj);
      expect(result).toEqual({ a: 1, self: '[circular]' });
    });

    test('summarizes deep nesting beyond depth 5', () => {
      let nested: Record<string, unknown> = { leaf: true };
      for (let i = 0; i < 6; i++) {
        nested = { child: nested };
      }

      const result = sanitizeLogValue(nested) as Record<string, unknown>;
      // Traverse 5 levels
      let current = result;
      for (let i = 0; i < 5; i++) {
        current = current.child as Record<string, unknown>;
      }
      // At depth 5, the object should be summarized
      expect(current).toEqual({ type: 'Object' });
    });

    test('serializes Map with sensitive key redaction', () => {
      const map = new Map<string, string>([
        ['username', 'alice'],
        ['password', 'secret123'],
      ]);

      const result = sanitizeLogValue(map) as { type: string; entries: [string, unknown][] };
      expect(result.type).toBe('Map');
      const passwordEntry = result.entries.find(([key]) => key === 'password');
      expect(passwordEntry![1]).toBe('[redacted]');
      const usernameEntry = result.entries.find(([key]) => key === 'username');
      expect(usernameEntry![1]).toBe('alice');
    });

    test('serializes Set values', () => {
      const set = new Set([1, 'hello', true]);

      const result = sanitizeLogValue(set) as { type: string; values: unknown[] };
      expect(result.type).toBe('Set');
      expect(result.values).toEqual([1, 'hello', true]);
    });

    test('sanitizes Error objects to structured form with scrubbed content', () => {
      const error = new Error('Connection failed with bearer my-token');
      error.name = 'NetworkError';

      const result = sanitizeLogValue(error) as Record<string, unknown>;
      expect(result.name).toBe('NetworkError');
      expect(result.message).toContain('bearer [redacted]');
      expect(result.message).not.toContain('my-token');
      expect(result).toHaveProperty('stack');
    });

    test('summarizes Buffer as { type, length }', () => {
      const originalBuffer = globalThis.Buffer;
      try {
        const buf = Buffer.from('hello world');
        const result = sanitizeLogValue(buf) as { type: string; length: number };
        expect(result.type).toBe('Buffer');
        expect(result.length).toBe(11);
      } finally {
        // Restore if needed
        (globalThis as any).Buffer = originalBuffer;
      }
    });

    test('summarizes Uint8Array as { type, length }', () => {
      const arr = new Uint8Array([1, 2, 3, 4, 5]);
      const result = sanitizeLogValue(arr) as { type: string; length: number };
      expect(result.type).toBe('Uint8Array');
      expect(result.length).toBe(5);
    });

    test('redacts signatureBytes but allows signatureStatus through', () => {
      const result = sanitizeLogValue({
        signatureBytes: 'abc123',
        signatureStatus: 'valid',
      }) as Record<string, unknown>;

      expect(result.signatureBytes).toBe('[redacted]');
      expect(result.signatureStatus).toBe('valid');
    });

    test('redacts signatureRaw and signedTransaction', () => {
      const result = sanitizeLogValue({
        signatureRaw: 'raw-data',
        signedTransaction: 'tx-bytes',
        signatureCount: 3,
        hasSignature: true,
      }) as Record<string, unknown>;

      expect(result.signatureRaw).toBe('[redacted]');
      expect(result.signedTransaction).toBe('[redacted]');
      expect(result.signatureCount).toBe(3);
      expect(result.hasSignature).toBe(true);
    });

    test('redacts responseBody and requestBody but allows bodyText through', () => {
      const result = sanitizeLogValue({
        responseBody: '{"secret": true}',
        requestBody: '{"payload": "data"}',
        bodyText: 'some text',
        body: 'plain body value',
      }) as Record<string, unknown>;

      expect(result.responseBody).toBe('[redacted]');
      expect(result.requestBody).toBe('[redacted]');
      expect(result.bodyText).toBe('some text');
      expect(result.body).toBe('plain body value');
    });

    test('redacts signatureMap', () => {
      const result = sanitizeLogValue({
        signatureMap: { key: 'value' },
      }) as Record<string, unknown>;

      expect(result.signatureMap).toBe('[redacted]');
    });
  });

  describe('normalizeLogArguments', () => {
    test('string-first: uses first arg as message, rest as metadata', () => {
      const result = normalizeLogArguments(['Hello', { extra: true }]);
      expect(result).toEqual({ message: 'Hello', metadata: { extra: true } });
    });

    test('Error-first: uses error message, includes error as metadata', () => {
      const err = new Error('boom');
      const result = normalizeLogArguments([err]);
      expect(result.message).toBe('boom');
      expect(result.metadata).toBe(err);
    });

    test('object-first: uses generic message with object as metadata', () => {
      const result = normalizeLogArguments([{ key: 'value' }]);
      expect(result.message).toBe('Structured log');
      expect(result.metadata).toEqual({ key: 'value' });
    });

    test('empty array: returns default message with no metadata', () => {
      const result = normalizeLogArguments([]);
      expect(result.message).toBe('Log entry');
      expect(result.metadata).toBeUndefined();
    });
  });

  describe('isLogLevel', () => {
    test('returns true for valid log levels', () => {
      expect(isLogLevel('error')).toBe(true);
      expect(isLogLevel('warn')).toBe(true);
      expect(isLogLevel('info')).toBe(true);
      expect(isLogLevel('debug')).toBe(true);
    });

    test('returns false for invalid values', () => {
      expect(isLogLevel('trace')).toBe(false);
      expect(isLogLevel('verbose')).toBe(false);
      expect(isLogLevel('')).toBe(false);
      expect(isLogLevel('INFO')).toBe(false);
    });
  });
});
