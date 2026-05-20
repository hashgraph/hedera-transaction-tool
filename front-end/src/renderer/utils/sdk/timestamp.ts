import { Timestamp } from '@hiero-ledger/sdk';

const NANOS_PER_SECOND = 1_000_000_000;

/**
 * Returns a new Timestamp equal to `base + nanoOffset` nanoseconds, rolling
 * any overflow past 1_000_000_000 nanos into the seconds component. The
 * input is not mutated.
 *
 * Used by the duplicate-transactionId (TEX) retry flow: when a payer submits
 * multiple transactions at the same validStart, retries shift the nanos
 * component by a small offset to produce a unique transactionId without
 * meaningfully changing the wall-clock time.
 */
export function applyNanoOffset(base: Timestamp, nanoOffset: number): Timestamp {
  if (nanoOffset === 0) return base;
  let nanos = base.nanos.toNumber() + nanoOffset;
  const overflow = Math.floor(nanos / NANOS_PER_SECOND);
  nanos = nanos % NANOS_PER_SECOND;
  return new Timestamp(base.seconds.toNumber() + overflow, nanos);
}
