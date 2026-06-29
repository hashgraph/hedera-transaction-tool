// @vitest-environment node
import { describe, test, expect } from 'vitest';

import { stringifyIpAddressBytes } from '@renderer/utils/sdk/getData';

describe('stringifyIpAddressBytes', () => {
  test('returns empty string for null', () => {
    expect(stringifyIpAddressBytes(null)).toBe('');
  });

  test('returns empty string for undefined', () => {
    expect(stringifyIpAddressBytes(undefined)).toBe('');
  });

  test('returns empty string for unrecognized byte length', () => {
    expect(stringifyIpAddressBytes(new Uint8Array([1, 2, 3]))).toBe('');
    expect(stringifyIpAddressBytes(new Uint8Array([1, 2, 3, 4, 5]))).toBe('');
  });

  describe('IPv4 (4 bytes)', () => {
    test('formats a standard IPv4 address', () => {
      expect(stringifyIpAddressBytes(new Uint8Array([192, 168, 1, 1]))).toBe('192.168.1.1');
    });

    test('formats all-zero IPv4 address', () => {
      expect(stringifyIpAddressBytes(new Uint8Array([0, 0, 0, 0]))).toBe('0.0.0.0');
    });

    test('formats all-max IPv4 address', () => {
      expect(stringifyIpAddressBytes(new Uint8Array([255, 255, 255, 255]))).toBe(
        '255.255.255.255',
      );
    });
  });

  describe('IPv6 (16 bytes) — RFC 5952 canonical form', () => {
    test('formats a full IPv6 address without any groups of only zeros', () => {
      // 2001:0db8:85a3:0001:0001:8a2e:0370:7334
      const bytes = new Uint8Array([
        0x20, 0x01, 0x0d, 0xb8, 0x85, 0xa3, 0x00, 0x01, 0x00, 0x01, 0x8a, 0x2e, 0x03, 0x70, 0x73,
        0x34,
      ]);
      expect(stringifyIpAddressBytes(bytes)).toBe('2001:db8:85a3:1:1:8a2e:370:7334');
    });

    test('compresses the longest run of consecutive groups of only zeros with ::', () => {
      // RFC 5952 §4 example: 2001:db8:0:0:0:ff00:42:8329 → 2001:db8::ff00:42:8329
      const bytes = new Uint8Array([
        0x20, 0x01, 0x0d, 0xb8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0x00, 0x42, 0x83,
        0x29,
      ]);
      expect(stringifyIpAddressBytes(bytes)).toBe('2001:db8::ff00:42:8329');
    });

    test('compresses loopback address ::1', () => {
      const bytes = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1]);
      expect(stringifyIpAddressBytes(bytes)).toBe('::1');
    });

    test('compresses all-zero address ::', () => {
      const bytes = new Uint8Array(16);
      expect(stringifyIpAddressBytes(bytes)).toBe('::');
    });

    test('does not compress a single group of only zeros', () => {
      // fe80:0:1:2:3:4:5:6 — the single zero group must not be replaced by ::
      const bytes = new Uint8Array([
        0xfe, 0x80, 0x00, 0x00, 0x00, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x00, 0x05, 0x00,
        0x06,
      ]);
      expect(stringifyIpAddressBytes(bytes)).toBe('fe80:0:1:2:3:4:5:6');
    });

    test('chooses the first run when two runs have equal length', () => {
      // 2001:db8:0:0:1:0:0:1 — two runs of two zeros; first wins → 2001:db8::1:0:0:1
      const bytes = new Uint8Array([
        0x20, 0x01, 0x0d, 0xb8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x01,
      ]);
      expect(stringifyIpAddressBytes(bytes)).toBe('2001:db8::1:0:0:1');
    });

    test('omits leading zeros in each group', () => {
      // 0001:0002:0003:0004:0005:0006:0007:0008 → 1:2:3:4:5:6:7:8
      const bytes = new Uint8Array([
        0x00, 0x01, 0x00, 0x02, 0x00, 0x03, 0x00, 0x04, 0x00, 0x05, 0x00, 0x06, 0x00, 0x07,
        0x00, 0x08,
      ]);
      expect(stringifyIpAddressBytes(bytes)).toBe('1:2:3:4:5:6:7:8');
    });
  });
});
