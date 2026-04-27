// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import {
  AccountId,
  FileId,
  FreezeTransaction,
  FreezeType,
  Timestamp,
  Transaction,
  TransactionId,
} from '@hiero-ledger/sdk';

import FreezeDetails from '@renderer/components/Transaction/Details/FreezeDetails.vue';

/**
 * Regression tests for issue #2586:
 *   FreezeAbort transaction incorrectly displays `file hash` as `0x`.
 *
 * Reproduction context: in production the details view receives a transaction
 * that was reconstructed from bytes (`Transaction.fromBytes`). After that
 * round-trip, the SDK's `FreezeTransaction.fileHash` getter returns an empty
 * `Buffer` (a `Uint8Array` subclass) — the protobuf default for `bytes` —
 * rather than null. An empty `Uint8Array` is truthy in JS, so the previous
 * `v-if="transaction.fileHash"` guard rendered the row anyway and `uint8ToHex`
 * produced `""`, which the template prefixed with `0x`.
 *
 * The fix changed the guard to `transaction.fileHash.length > 0`, which is
 * what these tests exercise.
 */
describe('FreezeDetails.vue', () => {
  /**
   * Build a frozen FreezeTransaction and round-trip it through bytes, so the
   * resulting object matches what the details view actually receives.
   */
  const roundTrip = (configure: (tx: FreezeTransaction) => FreezeTransaction) => {
    const base = new FreezeTransaction()
      .setNodeAccountIds([new AccountId(3)])
      .setTransactionId(
        TransactionId.withValidStart(new AccountId(2), Timestamp.fromDate(new Date())),
      );
    const frozen = configure(base).freeze();
    const parsed = Transaction.fromBytes(frozen.toBytes());
    if (!(parsed instanceof FreezeTransaction)) {
      throw new Error('round-trip did not produce a FreezeTransaction');
    }
    return parsed;
  };

  const mountWith = (transaction: Transaction) =>
    mount(FreezeDetails, {
      props: { transaction },
      global: {
        // Stub `DateTimeString` so we don't need to wire up its dependencies.
        stubs: { DateTimeString: true },
      },
    });

  const findFileHashRow = (wrapper: ReturnType<typeof mountWith>) =>
    wrapper
      .findAll('h4')
      .find(h => h.text() === 'File Hash')
      ?.element.parentElement ?? null;

  it('does NOT render the File Hash row for a FreezeAbort transaction', () => {
    const tx = roundTrip(t => t.setFreezeType(FreezeType.FreezeAbort));

    // Pre-conditions: this is the exact bug shape — fileHash is a Uint8Array
    // (Buffer) of length 0, NOT null/undefined.
    expect(tx.fileHash).toBeInstanceOf(Uint8Array);
    expect(tx.fileHash?.length).toBe(0);

    const wrapper = mountWith(tx);

    expect(findFileHashRow(wrapper)).toBeNull();
    expect(wrapper.text()).not.toContain('File Hash');
    // The bug symptom: a stray "0x" with nothing after it.
    expect(wrapper.text()).not.toMatch(/0x(?!\w)/);
  });

  it('does NOT render the File Hash row for FreezeOnly (no hash set)', () => {
    const tx = roundTrip(t =>
      t
        .setFreezeType(FreezeType.FreezeOnly)
        .setStartTimestamp(Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'))),
    );

    expect(tx.fileHash?.length ?? 0).toBe(0);

    const wrapper = mountWith(tx);

    expect(findFileHashRow(wrapper)).toBeNull();
    expect(wrapper.text()).not.toContain('File Hash');
  });

  it('renders the File Hash row for PrepareUpgrade when a hash is set', () => {
    // Arbitrary 4-byte hash -> hex "deadbeef".
    const hashBytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);

    const tx = roundTrip(t =>
      t
        .setFreezeType(FreezeType.PrepareUpgrade)
        .setFileId(FileId.fromString('0.0.150'))
        .setFileHash(hashBytes),
    );

    expect(tx.fileHash?.length).toBe(hashBytes.length);

    const wrapper = mountWith(tx);

    const row = findFileHashRow(wrapper);
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain('File Hash');
    // The template prefixes the hex with `0x` if not already present.
    expect(row?.textContent).toContain('0xdeadbeef');
  });
});
