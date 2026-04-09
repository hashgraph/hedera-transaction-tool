import { AccountId, Transaction } from '@hiero-ledger/sdk';

import {
  TRANSACTION_MAX_SIZE,
  TRANSACTION_MAX_PRIVILEGED_SIZE,
} from '@shared/constants';

/**
 * HIP-1300: Returns true when the given account is one of the privileged
 * governance fee payers that qualify for the increased 128 KB transaction
 * size limit.
 *
 * Privileged accounts:
 *   - 0.0.2 (Treasury)
 *   - 0.0.42 through 0.0.799 inclusive
 *
 * Reference: https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-1300.md
 */
export function isPrivilegedFeePayer(
  accountId: AccountId | string | null | undefined,
): boolean {
  if (!accountId) return false;
  let id: AccountId;
  try {
    id = typeof accountId === 'string' ? AccountId.fromString(accountId) : accountId;
  } catch {
    return false;
  }
  if (id.shard.toNumber() !== 0 || id.realm.toNumber() !== 0) return false;
  const num = id.num.toNumber();
  return num === 2 || (num >= 42 && num <= 799);
}

/**
 * HIP-1300: Returns the maximum allowed transaction size in bytes for a given
 * fee payer. Privileged governance accounts get 128 KB; everyone else gets 6 KB.
 */
export function getMaxTransactionSize(
  feePayer: AccountId | string | null | undefined,
): number {
  return isPrivilegedFeePayer(feePayer)
    ? TRANSACTION_MAX_PRIVILEGED_SIZE
    : TRANSACTION_MAX_SIZE;
}

/**
 * Convenience overload — derives the fee payer from the SDK transaction itself.
 */
export function getMaxTransactionSizeForTransaction(tx: Transaction): number {
  return getMaxTransactionSize(tx.transactionId?.accountId ?? null);
}

/**
 * Reserved headroom inside each File Append chunk for protobuf framing, the
 * transactionID, node account ID, and signature map. The maximum safe
 * `chunkSize` for the SDK is therefore `max transaction size − this reserve`,
 * otherwise the on-wire encoded transaction can exceed the limit at runtime.
 */
export const APPEND_CHUNK_OVERHEAD_BYTES = 644;

/**
 * HIP-1300: Returns the maximum safe File Append `chunkSize` for a given fee
 * payer — the transaction size limit minus the protobuf/signature overhead
 * reserve. Use this for any UI input that binds directly to the SDK
 * `chunkSize` property.
 */
export function getMaxChunkSize(
  feePayer: AccountId | string | null | undefined,
): number {
  return getMaxTransactionSize(feePayer) - APPEND_CHUNK_OVERHEAD_BYTES;
}
