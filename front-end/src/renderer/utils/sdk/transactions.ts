import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  FileAppendTransaction,
  FileContentsQuery,
  FileCreateTransaction,
  FileDeleteTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  FreezeType,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Transaction,
  TransferTransaction,
} from '@hashgraph/sdk';
import { TransactionTypeName } from '@shared/interfaces';
import { getTransactionById } from '@renderer/services/organization';
import { hexToUint8Array } from '@renderer/utils';

export const getTransactionPayerId = (transaction: Transaction) =>
  transaction.transactionId?.accountId?.toString() || null;

export const getTransactionValidStart = (transaction: Transaction) =>
  transaction.transactionId?.validStart?.toDate() || null;

export const formatTransactionType = (
  type: string,
  short = false,
  removeTransaction = false,
): string => {
  let result = type;
  if (removeTransaction) {
    // Remove ' Transaction' only if it appears at the end
    result = type.replace(/ Transaction$/, '');
  }
  if (short) {
    // Remove all whitespace characters
    result = type.replace(/\s+/g, '');
  }
  return result;
};

export const getTransactionTypeFromBackendType = (
  backendTransactionType: string,
  short = false,
  removeTransaction = false,
) => {
  let result: string;
  if (backendTransactionType in TransactionTypeName) {
    const type = backendTransactionType as keyof typeof TransactionTypeName;
    result = formatTransactionType(TransactionTypeName[type], short, removeTransaction);
  } else {
    result = 'Unknown Transaction Type';
  }
  return result;
};

export const getTransactionType = (
  transaction: Transaction | Uint8Array,
  short = false,
  removeTransaction = false,
) => {
  if (transaction instanceof Uint8Array) {
    transaction = Transaction.fromBytes(transaction);
  }

  let transactionType = 'Unknown Transaction Type';

  if (transaction instanceof AccountCreateTransaction) {
    transactionType = 'Account Create Transaction';
  } else if (transaction instanceof AccountUpdateTransaction) {
    transactionType = 'Account Update Transaction';
  } else if (transaction instanceof AccountDeleteTransaction) {
    transactionType = 'Account Delete Transaction';
  } else if (transaction instanceof TransferTransaction) {
    transactionType = 'Transfer Transaction';
  } else if (transaction instanceof AccountAllowanceApproveTransaction) {
    transactionType = 'Account Allowance Approve Transaction';
  } else if (transaction instanceof FileCreateTransaction) {
    transactionType = 'File Create Transaction';
  } else if (transaction instanceof FileUpdateTransaction) {
    transactionType = 'File Update Transaction';
  } else if (transaction instanceof FileAppendTransaction) {
    transactionType = 'File Append Transaction';
  } else if (transaction instanceof FileDeleteTransaction) {
    transactionType = 'File Delete Transaction';
  } else if (transaction instanceof FileContentsQuery) {
    transactionType = 'Read File Query';
  } else if (transaction instanceof FreezeTransaction) {
    transactionType = 'Freeze Transaction';
  } else if (transaction instanceof NodeCreateTransaction) {
    transactionType = 'Node Create Transaction';
  } else if (transaction instanceof NodeUpdateTransaction) {
    transactionType = 'Node Update Transaction';
  } else if (transaction instanceof NodeDeleteTransaction) {
    transactionType = 'Node Delete Transaction';
  } else if (transaction instanceof SystemDeleteTransaction) {
    transactionType = 'System Delete Transaction';
  } else if (transaction instanceof SystemUndeleteTransaction) {
    transactionType = 'System Undelete Transaction';
  }

  return formatTransactionType(transactionType, short, removeTransaction);
};

export const getFreezeTypeString = (freezeType: FreezeType) => {
  switch (freezeType) {
    case FreezeType.FreezeOnly:
      return 'Freeze Only';
    case FreezeType.PrepareUpgrade:
      return 'Prepare Upgrade';
    case FreezeType.FreezeUpgrade:
      return 'Freeze Upgrade';
    case FreezeType.FreezeAbort:
      return 'Freeze Abort';
    case FreezeType.TelemetryUpgrade:
      return 'Telemetry Upgrade';
    default:
      return 'Unknown';
  }
};

/**
 * Gets the display transaction type, including specific freeze types.
 * For freeze transactions, returns the specific freeze type (e.g., "Freeze Upgrade").
 * For other transactions, returns the standard type.
 *
 * @param transaction - SDK Transaction instance or Uint8Array
 * @param short - Whether to use short format (no spaces)
 * @param removeTransaction - Whether to remove " Transaction" suffix
 * @returns Display string for transaction type
 */
export const getDisplayTransactionType = (
  transaction: Transaction | Uint8Array,
  short = false,
  removeTransaction = false,
): string => {
  // Deserialize if needed
  let sdkTransaction = transaction;
  if (transaction instanceof Uint8Array) {
    try {
      sdkTransaction = Transaction.fromBytes(transaction);
    } catch (error) {
      console.error('Failed to deserialize transaction:', error);
      return formatTransactionType('Freeze Transaction', short, removeTransaction);
    }
  }

  // Check if this is a freeze transaction
  if (sdkTransaction instanceof FreezeTransaction) {
    const freezeType = sdkTransaction.freezeType;
    if (freezeType) {
      const freezeTypeStr = getFreezeTypeString(freezeType);
      return formatTransactionType(freezeTypeStr, short, removeTransaction);
    }
  }

  // Fall back to standard transaction type
  return getTransactionType(sdkTransaction, short, removeTransaction);
};

// Cache to avoid re-fetching freeze types
const freezeTypeCache = new Map<number, number | null>();

/**
 * Fetches the freeze type for a transaction from the backend.
 * Uses caching to avoid redundant API calls.
 *
 * @param serverUrl - The organization server URL
 * @param transactionId - The transaction ID
 * @returns The freeze type code (1-5) or null if not a freeze transaction or on error
 */
export const getFreezeTypeForTransaction = async (
  serverUrl: string,
  transactionId: number,
): Promise<number | null> => {
  if (freezeTypeCache.has(transactionId)) {
    return freezeTypeCache.get(transactionId)!;
  }

  try {
    const txFull = await getTransactionById(serverUrl, transactionId);
    const bytes = hexToUint8Array(txFull.transactionBytes);
    const sdkTx = Transaction.fromBytes(bytes);

    if (sdkTx instanceof FreezeTransaction && sdkTx.freezeType) {
      const code = sdkTx.freezeType._code;
      freezeTypeCache.set(transactionId, code);
      return code;
    }
  } catch (error) {
    console.error('Failed to fetch freeze type:', error);
  }

  freezeTypeCache.set(transactionId, null);
  return null;
};
