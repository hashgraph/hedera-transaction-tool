import {
  isLogLevel,
  normalizeLogArguments,
  sanitizeLogPayload,
  sanitizeLogValue,
  sanitizeMessageText,
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

  describe('sanitizeMessageText', () => {
    test('truncates message strings longer than 256 characters', () => {
      const longMsg = 'x'.repeat(300);
      const result = sanitizeMessageText(longMsg);
      expect(result).toBe('x'.repeat(256) + '...[truncated 44 chars]');
    });

    test('does not truncate message strings exactly 256 characters', () => {
      const exactMsg = 'y'.repeat(256);
      const result = sanitizeMessageText(exactMsg);
      expect(result).toBe(exactMsg);
    });

    test('scrubs PEM then truncates when message contains PEM and is long', () => {
      const pem = '-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJ\n-----END RSA PRIVATE KEY-----';
      const longText = 'A'.repeat(300);
      const msg = `${pem} ${longText}`;
      const result = sanitizeMessageText(msg);

      expect(result).not.toContain('MIIBogIBAAJ');
      expect(result).toContain('[redacted]');
      expect(result).toContain('...[truncated');
    });
  });

  describe('sanitizeLogValue (additional)', () => {
    test('returns "[function]" for function values', () => {
      const fn = () => 'hello';
      expect(sanitizeLogValue(fn)).toBe('[function]');
    });

    test('returns value.toString() for bigint values', () => {
      const big = BigInt(123456789012345678);
      expect(sanitizeLogValue(big)).toBe(big.toString());
    });

    test('returns .toISOString() for Date instances', () => {
      const date = new Date('2025-06-15T12:00:00Z');
      expect(sanitizeLogValue(date)).toBe('2025-06-15T12:00:00.000Z');
    });

    test('returns { type: "ArrayBuffer", length } for ArrayBuffer instances', () => {
      const buf = new ArrayBuffer(64);
      expect(sanitizeLogValue(buf)).toEqual({ type: 'ArrayBuffer', length: 64 });
    });

    test('returns { type: "Array", length } for arrays at depth >= 5', () => {
      const arr = [1, 2, 3];
      expect(sanitizeLogValue(arr, { depth: 5 })).toEqual({ type: 'Array', length: 3 });
    });

    test('returns { type: "Map", size } for Map at depth >= 5', () => {
      const map = new Map([['a', 1], ['b', 2]]);
      expect(sanitizeLogValue(map, { depth: 5 })).toEqual({ type: 'Map', size: 2 });
    });

    test('returns { type: "Set", size } for Set at depth >= 5', () => {
      const set = new Set([10, 20, 30]);
      expect(sanitizeLogValue(set, { depth: 5 })).toEqual({ type: 'Set', size: 3 });
    });

    test('returns { type: "Object" } for empty plain objects', () => {
      expect(sanitizeLogValue({})).toEqual({ type: 'Object' });
    });

    test('returns null as-is', () => {
      expect(sanitizeLogValue(null)).toBeNull();
    });

    test('returns undefined as-is', () => {
      expect(sanitizeLogValue(undefined)).toBeUndefined();
    });

    test('diamond reference (same object, two keys) renders both, not [circular]', () => {
      const shared = { value: 42 };
      const diamond = { a: shared, b: shared };

      const result = sanitizeLogValue(diamond) as Record<string, unknown>;
      expect(result.a).toEqual({ value: 42 });
      expect(result.b).toEqual({ value: 42 });
    });

    test('tokenId, tokenBalance, tokenType, tokenName pass through (not redacted)', () => {
      const result = sanitizeLogValue({
        tokenId: '0.0.12345',
        tokenBalance: 1000,
        tokenType: 'FUNGIBLE_COMMON',
        tokenName: 'MyToken',
      }) as Record<string, unknown>;

      expect(result.tokenId).toBe('0.0.12345');
      expect(result.tokenBalance).toBe(1000);
      expect(result.tokenType).toBe('FUNGIBLE_COMMON');
      expect(result.tokenName).toBe('MyToken');
    });

    test('accessToken and refreshToken are redacted', () => {
      const result = sanitizeLogValue({
        accessToken: 'abc123',
        refreshToken: 'def456',
      }) as Record<string, unknown>;

      expect(result.accessToken).toBe('[redacted]');
      expect(result.refreshToken).toBe('[redacted]');
    });

    test('authorization key is redacted', () => {
      const result = sanitizeLogValue({ authorization: 'Bearer xyz' }) as Record<string, unknown>;
      expect(result.authorization).toBe('[redacted]');
    });

    test('cookie key is redacted', () => {
      const result = sanitizeLogValue({ cookie: 'session=abc' }) as Record<string, unknown>;
      expect(result.cookie).toBe('[redacted]');
    });

    test('secret key is redacted', () => {
      const result = sanitizeLogValue({ secret: 'my-secret' }) as Record<string, unknown>;
      expect(result.secret).toBe('[redacted]');
    });

    test('privatekey key is redacted', () => {
      const result = sanitizeLogValue({ privatekey: '302e...' }) as Record<string, unknown>;
      expect(result.privatekey).toBe('[redacted]');
    });

    test('mnemonic key is redacted', () => {
      const result = sanitizeLogValue({ mnemonic: 'word1 word2 word3' }) as Record<string, unknown>;
      expect(result.mnemonic).toBe('[redacted]');
    });

    test('recoveryphrase key is redacted', () => {
      const result = sanitizeLogValue({ recoveryphrase: 'phrase words' }) as Record<string, unknown>;
      expect(result.recoveryphrase).toBe('[redacted]');
    });

    test('seed key is redacted', () => {
      const result = sanitizeLogValue({ seed: 'seed-bytes' }) as Record<string, unknown>;
      expect(result.seed).toBe('[redacted]');
    });

    test('pem key is redacted', () => {
      const result = sanitizeLogValue({ pem: 'pem-content' }) as Record<string, unknown>;
      expect(result.pem).toBe('[redacted]');
    });

    test('encrypted key is redacted', () => {
      const result = sanitizeLogValue({ encrypted: 'cipher-text' }) as Record<string, unknown>;
      expect(result.encrypted).toBe('[redacted]');
    });

    test('secrethash key is redacted', () => {
      const result = sanitizeLogValue({ secrethash: 'hash-value' }) as Record<string, unknown>;
      expect(result.secrethash).toBe('[redacted]');
    });

    test('key normalization: jwt_token is redacted', () => {
      const result = sanitizeLogValue({ jwt_token: 'abc' }) as Record<string, unknown>;
      expect(result.jwt_token).toBe('[redacted]');
    });

    test('key normalization: JWT-TOKEN is redacted', () => {
      const result = sanitizeLogValue({ 'JWT-TOKEN': 'abc' }) as Record<string, unknown>;
      expect(result['JWT-TOKEN']).toBe('[redacted]');
    });

    test('key normalization: private_key is redacted', () => {
      const result = sanitizeLogValue({ private_key: 'key-data' }) as Record<string, unknown>;
      expect(result.private_key).toBe('[redacted]');
    });

    test('key normalization: recovery_phrase is redacted', () => {
      const result = sanitizeLogValue({ recovery_phrase: 'words' }) as Record<string, unknown>;
      expect(result.recovery_phrase).toBe('[redacted]');
    });
  });

  describe('sanitizeLogPayload (additional scrubSensitiveString patterns)', () => {
    test('BEARER_PATTERN scrubs capitalized "Bearer"', () => {
      const payload = sanitizeLogPayload(['Auth: Bearer my-secret-token']);
      expect(payload.message).not.toContain('my-secret-token');
      expect(payload.message).toContain('bearer [redacted]');
    });

    test('BEARER_PATTERN scrubs uppercase "BEARER"', () => {
      const payload = sanitizeLogPayload(['Auth: BEARER my-secret-token']);
      expect(payload.message).not.toContain('my-secret-token');
      expect(payload.message).toContain('bearer [redacted]');
    });

    test('PEM_PATTERN scrubs CERTIFICATE blocks', () => {
      const pem = '-----BEGIN CERTIFICATE-----\nMIIBxyz\n-----END CERTIFICATE-----';
      const payload = sanitizeLogPayload([`Cert loaded: ${pem}`]);
      expect(payload.message).not.toContain('MIIBxyz');
      expect(payload.message).toContain('[redacted]');
    });

    test('PEM_PATTERN scrubs PUBLIC KEY blocks', () => {
      const pem = '-----BEGIN PUBLIC KEY-----\nMFkwEabc\n-----END PUBLIC KEY-----';
      const payload = sanitizeLogPayload([`Key: ${pem}`]);
      expect(payload.message).not.toContain('MFkwEabc');
      expect(payload.message).toContain('[redacted]');
    });

    test('PEM_PATTERN scrubs EC PRIVATE KEY blocks', () => {
      const pem = '-----BEGIN EC PRIVATE KEY-----\nMHQCAabc\n-----END EC PRIVATE KEY-----';
      const payload = sanitizeLogPayload([`EC Key: ${pem}`]);
      expect(payload.message).not.toContain('MHQCAabc');
      expect(payload.message).toContain('[redacted]');
    });

    test('HEX_PAYLOAD_PATTERN summarizes standalone 128+ hex string in metadata', () => {
      const hexStr = 'a1b2c3d4'.repeat(20); // 160 hex chars
      const payload = sanitizeLogPayload(['Hex data', { txBytes: hexStr }]);
      expect((payload.metadata as Record<string, unknown>).txBytes).toEqual({
        type: 'string',
        length: hexStr.length,
        summary: 'payload omitted',
      });
    });

    test('BASE64_PAYLOAD_PATTERN summarizes standalone 128+ base64 string in metadata', () => {
      const b64Str = 'QUJDREVGR0g='.repeat(15); // 180 chars
      const payload = sanitizeLogPayload(['Base64 data', { encoded: b64Str }]);
      expect((payload.metadata as Record<string, unknown>).encoded).toEqual({
        type: 'string',
        length: b64Str.length,
        summary: 'payload omitted',
      });
    });
  });

  describe('normalizeLogArguments (additional)', () => {
    test('rest.length > 1: metadata is the array of rest args', () => {
      const result = normalizeLogArguments(['msg', 'extra1', 'extra2']);
      expect(result.message).toBe('msg');
      expect(result.metadata).toEqual(['extra1', 'extra2']);
    });

    test('Error with empty message falls back to name then "Error"', () => {
      const err = new Error('');
      err.name = 'CustomError';
      const result = normalizeLogArguments([err]);
      expect(result.message).toBe('CustomError');

      const err2 = new Error('');
      err2.name = '';
      const result2 = normalizeLogArguments([err2]);
      expect(result2.message).toBe('Error');
    });

    test('multiple args where first is Error: metadata is the full array', () => {
      const err = new Error('fail');
      const result = normalizeLogArguments([err, { context: 'extra' }]);
      expect(result.message).toBe('fail');
      expect(result.metadata).toEqual([err, { context: 'extra' }]);
    });

    test('non-string, non-Error, non-object first arg (number): message is "Structured log"', () => {
      const result = normalizeLogArguments([42]);
      expect(result.message).toBe('Structured log');
      expect(result.metadata).toBe(42);
    });
  });
});
