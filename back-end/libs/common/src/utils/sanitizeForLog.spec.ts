import { sanitizeForLog } from './sanitizeForLog';

describe('sanitizeForLog', () => {
  it('leaves ordinary strings unchanged', () => {
    expect(sanitizeForLog('GET /transactions 200 - 12ms')).toBe('GET /transactions 200 - 12ms');
  });

  it('escapes U+2028 (line separator)', () => {
    expect(sanitizeForLog('before after')).toBe('before\\u2028after');
  });

  it('escapes U+2029 (paragraph separator)', () => {
    expect(sanitizeForLog('before after')).toBe('before\\u2029after');
  });

  it('escapes multiple occurrences', () => {
    expect(sanitizeForLog('a b c d')).toBe('a\\u2028b\\u2029c\\u2028d');
  });

  it('does not touch a JSON.stringify payload embedding the separators', () => {
    const serialized = JSON.stringify({ name: 'line1 line2' });
    expect(sanitizeForLog(serialized)).toBe('{"name":"line1\\u2028line2"}');
  });
});
