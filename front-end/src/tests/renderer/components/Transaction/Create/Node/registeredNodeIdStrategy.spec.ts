// @vitest-environment node
import { describe, test, expect } from 'vitest';

import { registeredNodeIdStrategy } from '@renderer/components/Transaction/Create/Node/registeredNodeIdStrategy';

const { sanitize, parse, format, display } = registeredNodeIdStrategy;

describe('registeredNodeIdStrategy.sanitize', () => {
  test('preserves digits, commas, hyphens, and whitespace', () => {
    expect(sanitize('1, 2-5, 7')).toBe('1, 2-5, 7');
  });

  test('strips letters and other punctuation', () => {
    expect(sanitize('1a,b2-c3.x/y!')).toBe('1,2-3');
  });

  test('collapses runs of commas', () => {
    expect(sanitize('1,,2,,,3')).toBe('1,2,3');
  });

  test('collapses runs of hyphens', () => {
    expect(sanitize('1--3')).toBe('1-3');
  });

  test('collapses comma / hyphen runs with whitespace between', () => {
    expect(sanitize('1 , , 2 - - 5')).toBe('1 , 2 - 5');
  });

  test('leaves single comma and hyphen alone', () => {
    expect(sanitize('1,2-3')).toBe('1,2-3');
  });

  test('strips a leading space', () => {
    expect(sanitize(' 1, 2')).toBe('1, 2');
  });

  test('strips a leading tab', () => {
    expect(sanitize('\t1, 2')).toBe('1, 2');
  });

  test('collapses runs of whitespace into a single space', () => {
    expect(sanitize('1,  2,   3')).toBe('1, 2, 3');
  });

  test('collapses mixed tabs and spaces', () => {
    expect(sanitize('1, \t 2')).toBe('1, 2');
  });
});

describe('registeredNodeIdStrategy.parse', () => {
  test('parses a CSV of single integers', () => {
    expect(parse('1, 2, 3')).toEqual({ ids: ['1', '2', '3'] });
  });

  test('expands ranges inclusively', () => {
    expect(parse('2-5')).toEqual({ ids: ['2', '3', '4', '5'] });
  });

  test('mixes singletons and ranges', () => {
    expect(parse('1, 5, 10-12')).toEqual({ ids: ['1', '5', '10', '11', '12'] });
  });

  test('dedupes overlapping ranges and singletons', () => {
    expect(parse('1-3, 2, 3-5')).toEqual({ ids: ['1', '2', '3', '4', '5'] });
  });

  test('sorts ascending regardless of input order', () => {
    expect(parse('10, 3, 5-7, 1')).toEqual({ ids: ['1', '3', '5', '6', '7', '10'] });
  });

  test('accepts zero', () => {
    expect(parse('0')).toEqual({ ids: ['0'] });
  });

  test('rejects descending range', () => {
    const result = parse('5-3');
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toContain('5-3');
    }
  });

  test('rejects non-numeric range bounds', () => {
    const result = parse('a-5');
    expect(result).toHaveProperty('error');
  });

  test('rejects non-integer single value', () => {
    const result = parse('1.5');
    expect(result).toHaveProperty('error');
  });

  test('ignores empty tokens from trailing or repeated commas in pre-sanitized input', () => {
    // After sanitize this shouldn't happen, but parse should still be tolerant.
    expect(parse('1, ,2')).toEqual({ ids: ['1', '2'] });
  });

  test('empty input parses as empty list', () => {
    expect(parse('')).toEqual({ ids: [] });
  });

  test('preserves values above Number.MAX_SAFE_INTEGER (uint64 precision)', () => {
    // 2^60 — well above MAX_SAFE_INTEGER (2^53−1) but a valid uint64 value.
    // Using `Number(...)` would round this; BigInt must preserve it.
    const big = (2n ** 60n).toString();
    expect(parse(big)).toEqual({ ids: [big] });
  });

  test('rejects a range with more than two bounds (no silent truncation)', () => {
    // Without explicit shape validation, destructuring would take `1` and
    // `2` and silently drop the `3`. Must error instead.
    const result = parse('1-2-3');
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error).toContain('1-2-3');
    }
  });

  test('rejects a range with a missing lower bound', () => {
    // `BigInt("")` is `0n`, so without a shape check `-5` would silently
    // parse as the range `0-5`.
    const result = parse('-5');
    expect(result).toHaveProperty('error');
  });

  test('rejects a range with a missing upper bound', () => {
    const result = parse('5-');
    expect(result).toHaveProperty('error');
  });

  test('rejects a bare hyphen', () => {
    const result = parse('-');
    expect(result).toHaveProperty('error');
  });

  test('rejects an oversized range without materializing it', () => {
    // Would expand to ~10^12 entries unguarded — must reject before allocation.
    const result = parse('0-1000000000000');
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error.toLowerCase()).toContain('range too large');
    }
  });

  test('accepts a range exactly at the per-range cap (20 entries)', () => {
    // `0-19` = 20 inclusive entries = the maxIds limit. Must be allowed.
    const result = parse('0-19');
    expect(result).toEqual({
      ids: Array.from({ length: 20 }, (_, i) => String(i)),
    });
  });

  test('rejects a range one beyond the per-range cap (21 entries)', () => {
    // `0-20` = 21 inclusive entries = one past the cap.
    const result = parse('0-20');
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error.toLowerCase()).toContain('range too large');
    }
  });

  test('short-circuits when total unique IDs blow past the defensive cap', () => {
    // Many small ranges/tokens can accumulate past `maxIds` before the
    // downstream check sees the result — parse must short-circuit instead
    // of churning through a giant pasted blob.
    const tokens = Array.from({ length: 500 }, (_, i) => String(i)).join(',');
    const result = parse(tokens);
    expect(result).toHaveProperty('error');
    if ('error' in result) {
      expect(result.error.toLowerCase()).toContain('too many ids');
    }
  });
});

describe('registeredNodeIdStrategy.format', () => {
  test('empty list renders as empty string', () => {
    expect(format([])).toBe('');
  });

  test('singletons rendered as comma-separated list', () => {
    expect(format(['1', '3', '5'])).toBe('1, 3, 5');
  });

  test('consecutive integers collapse into a range', () => {
    expect(format(['1', '2', '3', '4', '5'])).toBe('1-5');
  });

  test('non-consecutive runs collapse independently', () => {
    expect(format(['1', '2', '3', '7', '8', '10'])).toBe('1-3, 7-8, 10');
  });

  test('numeric (not lexical) sort', () => {
    expect(format(['10', '2', '1'])).toBe('1-2, 10');
  });

  test('preserves values above Number.MAX_SAFE_INTEGER (uint64 precision)', () => {
    const big = (2n ** 60n).toString();
    expect(format([big])).toBe(big);
  });

  test('does not throw on invalid entries — renders the valid subset', () => {
    // `format` is called with whatever the parent passes in modelValue, so a
    // single bad value (from a stale draft, API blob, etc.) must not crash.
    expect(format(['1', 'abc', '3'])).toBe('1, 3');
  });

  test('skips negative entries (invalid uint64) without crashing', () => {
    // BigInt('-5') doesn't throw but is an illegal uint64; format must drop it.
    expect(format(['-5', '1', '2'])).toBe('1-2');
  });

  test('returns empty string when every entry is invalid', () => {
    expect(format(['abc', '1.5', '-1'])).toBe('');
  });

  test('dedupes duplicate entries before collapsing into ranges', () => {
    // Without dedup, the run-collapsing loop would see [1, 1, 2] and emit
    // a lone `1` and then a fresh `1-2` run, producing "1, 1-2".
    expect(format(['1', '1', '2'])).toBe('1-2');
  });
});

describe('registeredNodeIdStrategy.display', () => {
  test('display returns the id as-is', () => {
    expect(display('42')).toBe('42');
  });
});

describe('registeredNodeIdStrategy round-trip', () => {
  test('format -> parse yields the same set', () => {
    const ids = ['1', '2', '3', '7', '8', '10'];
    const text = format(ids);
    const reparsed = parse(text);
    expect(reparsed).toEqual({ ids });
  });

  test('remove-then-format produces compact output (example from comment)', () => {
    // Starting from 5-10, drop 7 → expect "5-6, 8-10".
    const after = ['5', '6', '8', '9', '10'];
    expect(format(after)).toBe('5-6, 8-10');
  });
});
