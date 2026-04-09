import { AccountId, Transaction as SDKTransaction } from '@hiero-ledger/sdk';

import {
  MAX_TRANSACTION_BYTE_SIZE,
  MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE,
} from '../../database/entities/transaction.entity';

/**
 * HIP-1300: Returns true when the given account is one of the privileged
 * governance fee payers that qualify for the increased 128 KB transaction
 * size limit.
 *
 * Privileged accounts:
 *   - 0.0.2 (Treasury)
 *   - 0.0.42 through 0.0.799 inclusive (governance accounts)
 *
 * Reference: https://github.com/hiero-ledger/hiero-improvement-proposals/blob/main/HIP/hip-1300.md
 */
export function isPrivilegedFeePayer(accountId: AccountId | null | undefined): boolean {
  if (!accountId) return false;
  if (accountId.shard.toNumber() !== 0 || accountId.realm.toNumber() !== 0) return false;
  const num = accountId.num.toNumber();
  return num === 2 || (num >= 42 && num <= 799);
}

/**
 * Extracts the fee payer account from an SDK transaction. The fee payer is
 * encoded as the account portion of the TransactionId.
 */
export function getFeePayerFromSdkTransaction(tx: SDKTransaction): AccountId | null {
  return tx.transactionId?.accountId ?? null;
}

/**
 * HIP-1300: Returns the maximum allowed transaction size in bytes for a given
 * fee payer. Privileged governance accounts get 128 KB; everyone else gets 6 KB.
 */
export function getMaxTransactionSize(feePayer: AccountId | null | undefined): number {
  return isPrivilegedFeePayer(feePayer)
    ? MAX_PRIVILEGED_TRANSACTION_BYTE_SIZE
    : MAX_TRANSACTION_BYTE_SIZE;
}

/**
 * Convenience overload — derives the fee payer from the SDK transaction itself.
 */
export function getMaxTransactionSizeForTransaction(tx: SDKTransaction): number {
  return getMaxTransactionSize(getFeePayerFromSdkTransaction(tx));
}
