// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { Timestamp } from '@hiero-ledger/sdk';

import { applyNanoOffset } from '@renderer/utils/sdk/timestamp';

describe('applyNanoOffset', () => {
  test('returns the same instance when offset is 0', () => {
    const base = new Timestamp(1_700_000_000, 12345);
    const result = applyNanoOffset(base, 0);
    expect(result).toBe(base);
  });

  test('adds nanos without crossing a second boundary', () => {
    const base = new Timestamp(1_700_000_000, 12345);
    const result = applyNanoOffset(base, 1000);
    expect(result.seconds.toNumber()).toBe(1_700_000_000);
    expect(result.nanos.toNumber()).toBe(13345);
  });

  test('rolls into the next second when nanos overflow', () => {
    // 999,500,000 + 1,000,000 = 1,000,500,000 → +1 second, 500,000 nanos
    const base = new Timestamp(1_700_000_000, 999_500_000);
    const result = applyNanoOffset(base, 1_000_000);
    expect(result.seconds.toNumber()).toBe(1_700_000_001);
    expect(result.nanos.toNumber()).toBe(500_000);
  });

  test('exact 1-second overflow lands on nanos=0 of next second', () => {
    const base = new Timestamp(1_700_000_000, 0);
    const result = applyNanoOffset(base, 1_000_000_000);
    expect(result.seconds.toNumber()).toBe(1_700_000_001);
    expect(result.nanos.toNumber()).toBe(0);
  });

  test('rolls multiple seconds for offsets larger than 1B nanos', () => {
    // 3.5 second offset on top of nanos=500_000_000
    const base = new Timestamp(1_700_000_000, 500_000_000);
    const result = applyNanoOffset(base, 3_500_000_000);
    // total nanos = 4_000_000_000 → +4 seconds, 0 nanos
    expect(result.seconds.toNumber()).toBe(1_700_000_004);
    expect(result.nanos.toNumber()).toBe(0);
  });

  test('handles a max-bucket retry offset (just under 1 ms) without overflow when nanos is mid-second', () => {
    // 999,999 ns offset is the max produced by the retry jitter when in bucket 3.
    const base = new Timestamp(1_700_000_000, 500_000_000);
    const result = applyNanoOffset(base, 999_999);
    expect(result.seconds.toNumber()).toBe(1_700_000_000);
    expect(result.nanos.toNumber()).toBe(500_999_999);
  });

  test('handles a max-bucket retry offset with overflow when nanos is near end of second', () => {
    // nanos near top of the second; 999_999 ns offset pushes past 1B.
    const base = new Timestamp(1_700_000_000, 999_500_000);
    const result = applyNanoOffset(base, 999_999);
    // 999_500_000 + 999_999 = 1_000_499_999 → +1 second, 499_999 nanos
    expect(result.seconds.toNumber()).toBe(1_700_000_001);
    expect(result.nanos.toNumber()).toBe(499_999);
  });

  test('does not mutate the input Timestamp', () => {
    const base = new Timestamp(1_700_000_000, 999_500_000);
    const beforeSeconds = base.seconds.toNumber();
    const beforeNanos = base.nanos.toNumber();
    applyNanoOffset(base, 1_000_000);
    expect(base.seconds.toNumber()).toBe(beforeSeconds);
    expect(base.nanos.toNumber()).toBe(beforeNanos);
  });
});
