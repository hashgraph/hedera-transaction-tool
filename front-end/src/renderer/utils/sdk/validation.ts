import { FileUpdateTransaction, type Transaction } from '@hiero-ledger/sdk';

const TREASURY = '0.0.2';
const SYSTEM_ADMIN = '0.0.50';
const ADDRESS_BOOK_ADMIN = '0.0.55';
const FEE_SCHEDULES_ADMIN = '0.0.56';
const EXCHANGE_RATE_ADMIN = '0.0.57';
const FREEZE_ADMIN = '0.0.58';

const fileIdPermissions: { [key: string]: string[] } = {
  '0.0.101': [TREASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN],
  '0.0.102': [TREASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN],
  '0.0.111': [TREASURY, SYSTEM_ADMIN, FEE_SCHEDULES_ADMIN],
  '0.0.112': [TREASURY, SYSTEM_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.121': [TREASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.122': [TREASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.123': [TREASURY, SYSTEM_ADMIN, ADDRESS_BOOK_ADMIN, EXCHANGE_RATE_ADMIN],
  '0.0.150': [TREASURY, SYSTEM_ADMIN, FREEZE_ADMIN],
};

export const validateFileUpdateTransaction = (transaction: Transaction) => {
  if (!(transaction instanceof FileUpdateTransaction)) {
    return;
  }

  const payerId = transaction.transactionId?.accountId?.toString();
  const fileId = transaction.fileId;

  if (!fileId || !payerId) {
    return;
  }

  const permissions = fileIdPermissions[fileId.toString()];
  if (!permissions) {
    return;
  }

  if (!permissions.includes(payerId)) {
    throw new Error('Invalid payer ID: System files can only be updated by authorized accounts');
  }
};

export function validate100CharInput(str: string, inputDescription: string) {
  if (str.length > 100) {
    throw new Error(`${inputDescription} is limited to 100 characters`);
  }
}

/**
 * UTF-8 byte length of a string. Use instead of `.length` (UTF-16 code units)
 * whenever a proto contract specifies a byte limit — most Hedera string fields
 * are byte-limited (memo, description, etc.).
 */
export function utf8ByteLength(str: string): number {
  return new TextEncoder().encode(str).length;
}

/** Returns true if the string's UTF-8 byte length is strictly greater than the limit. */
export function exceedsUtf8ByteLimit(str: string, byteLimit: number): boolean {
  return utf8ByteLength(str) > byteLimit;
}

/**
 * Byte-aware analogue of `validate100CharInput`. The HIP for registered nodes
 * (and several other proto contracts) specifies `100 bytes UTF-8`, not 100
 * characters — `.length` counts UTF-16 code units, which under-counts emoji
 * and over-counts surrogate pairs.
 */
export function validate100ByteInput(str: string, inputDescription: string) {
  if (exceedsUtf8ByteLimit(str, 100)) {
    throw new Error(`${inputDescription} is limited to 100 bytes (UTF-8)`);
  }
}

export const transactionIs = <T extends Transaction>(
  type: new (...args: any[]) => T,
  transaction: Transaction,
): transaction is T => {
  return transaction instanceof type;
};
