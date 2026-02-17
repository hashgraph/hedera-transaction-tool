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
    result = result.replace(/\s+/g, '');
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

/** Input for backend transaction type (e.g., from ITransactionNode) */
export interface BackendTypeInput {
  backendType: string;
  freezeType?: FreezeType | null;
}

/** Input for local/draft transaction type */
export interface LocalTypeInput {
  localType: string;
  transactionBytes?: string;
}

/** All supported input types for getDisplayTransactionType */
export type TransactionTypeInput =
  | Transaction
  | Uint8Array
  | BackendTypeInput
  | LocalTypeInput;

/** Type guard for BackendTypeInput */
function isBackendTypeInput(input: TransactionTypeInput): input is BackendTypeInput {
  return typeof input === 'object' && 'backendType' in input;
}

/** Type guard for LocalTypeInput */
function isLocalTypeInput(input: TransactionTypeInput): input is LocalTypeInput {
  return typeof input === 'object' && 'localType' in input;
}

/**
 * Gets the display transaction type, including specific freeze types.
 * Accepts multiple input formats:
 * - SDK Transaction or Uint8Array: Extracts type from transaction, including freeze subtype
 * - { backendType, freezeType? }: Converts backend type (e.g., 'FREEZE') to display format
 * - { localType, transactionBytes? }: Formats local type, extracts freeze subtype if bytes provided
 *
 * @param input - Transaction, Uint8Array, BackendTypeInput, or LocalTypeInput
 * @param short - Whether to use short format (no spaces)
 * @param removeTransaction - Whether to remove " Transaction" suffix
 * @returns Display string for transaction type
 */
export const getDisplayTransactionType = (
  input: TransactionTypeInput,
  short = false,
  removeTransaction = false,
): string => {
  // Handle backend type input (e.g., from ITransactionNode)
  if (isBackendTypeInput(input)) {
    // If freeze type is provided, use it directly
    if (input.backendType === 'FREEZE' && input.freezeType) {
      return formatTransactionType(getFreezeTypeString(input.freezeType), short, removeTransaction);
    }
    // Otherwise convert backend type to display format
    return getTransactionTypeFromBackendType(input.backendType, short, removeTransaction);
  }

  // Handle local/draft type input
  if (isLocalTypeInput(input)) {
    // For freeze transactions with bytes, try to extract specific freeze type
    const isFreezeType = ['Freeze Transaction', 'FreezeTransaction', 'Freeze', 'FREEZE'].includes(
      input.localType,
    );
    if (isFreezeType && input.transactionBytes) {
      try {
        const bytesArray = input.transactionBytes.split(',').map(n => Number(n));
        const sdkTx = Transaction.fromBytes(new Uint8Array(bytesArray));
        if (sdkTx instanceof FreezeTransaction && sdkTx.freezeType) {
          return formatTransactionType(
            getFreezeTypeString(sdkTx.freezeType),
            short,
            removeTransaction,
          );
        }
      } catch {
        // Fall through to default formatting
      }
    }
    return formatTransactionType(input.localType, short, removeTransaction);
  }

  // Handle SDK Transaction or Uint8Array
  let sdkTransaction = input;
  if (input instanceof Uint8Array) {
    try {
      sdkTransaction = Transaction.fromBytes(input);
    } catch (error) {
      console.error('Failed to deserialize transaction:', error);
      return formatTransactionType('Freeze Transaction', short, removeTransaction);
    }
  }

  // Check if this is a freeze transaction
  if (sdkTransaction instanceof FreezeTransaction) {
    const freezeType = sdkTransaction.freezeType;
    if (freezeType) {
      return formatTransactionType(getFreezeTypeString(freezeType), short, removeTransaction);
    }
  }

  // Fall back to standard transaction type
  return getTransactionType(sdkTransaction, short, removeTransaction);
};

// LRU cache to avoid re-fetching freeze types (keyed by serverUrl + transactionId)
const FREEZE_TYPE_CACHE_MAX_SIZE = 250;
const freezeTypeCache = new Map<string, FreezeType | null>();

const makeFreezeTypeCacheKey = (serverUrl: string, transactionId: number): string => {
  return `${transactionId}/${serverUrl}`;
};

const setFreezeTypeCache = (key: string, value: FreezeType | null): void => {
  // Delete and re-add to move to end (most recently used)
  if (freezeTypeCache.has(key)) {
    freezeTypeCache.delete(key);
  }
  // Evict oldest entry if at capacity
  if (freezeTypeCache.size >= FREEZE_TYPE_CACHE_MAX_SIZE) {
    const oldestKey = freezeTypeCache.keys().next().value;
    if (oldestKey !== undefined) {
      freezeTypeCache.delete(oldestKey);
    }
  }
  freezeTypeCache.set(key, value);
};

const getFreezeTypeFromCache = (key: string): FreezeType | null | undefined => {
  if (!freezeTypeCache.has(key)) {
    return undefined;
  }
  // Move to end (mark as recently used)
  const value = freezeTypeCache.get(key)!;
  freezeTypeCache.delete(key);
  freezeTypeCache.set(key, value);
  return value;
};

/**
 * Fetches the freeze type for a transaction from the backend.
 * Uses caching to avoid redundant API calls.
 *
 * @param serverUrl - The organization server URL
 * @param transactionId - The transaction ID
 * @returns The FreezeType enum value or null if not a freeze transaction or on error
 */
export const getFreezeTypeForTransaction = async (
  serverUrl: string,
  transactionId: number,
): Promise<FreezeType | null> => {
  const cacheKey = makeFreezeTypeCacheKey(serverUrl, transactionId);
  const cached = getFreezeTypeFromCache(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const txFull = await getTransactionById(serverUrl, transactionId);
    const bytes = hexToUint8Array(txFull.transactionBytes);
    const sdkTx = Transaction.fromBytes(bytes);

    if (sdkTx instanceof FreezeTransaction && sdkTx.freezeType) {
      setFreezeTypeCache(cacheKey, sdkTx.freezeType);
      return sdkTx.freezeType;
    }
  } catch (error) {
    console.error('Failed to fetch freeze type:', error);
  }

  setFreezeTypeCache(cacheKey, null);
  return null;
};
