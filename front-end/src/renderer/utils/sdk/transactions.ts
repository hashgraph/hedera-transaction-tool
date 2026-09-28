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
  RegisteredNodeCreateTransaction,
  RegisteredNodeDeleteTransaction,
  RegisteredNodeUpdateTransaction,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Transaction,
  TransferTransaction,
} from '@hiero-ledger/sdk';
import { TransactionTypeName } from '@shared/interfaces';
import { createLogger } from '@renderer/utils/logger';

const logger = createLogger('renderer.sdk.transactions');

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
  } else if (transaction instanceof RegisteredNodeCreateTransaction) {
    transactionType = 'Registered Node Create Transaction';
  } else if (transaction instanceof RegisteredNodeUpdateTransaction) {
    transactionType = 'Registered Node Update Transaction';
  } else if (transaction instanceof RegisteredNodeDeleteTransaction) {
    transactionType = 'Registered Node Delete Transaction';
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
  | string
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
 * Extracts the raw, unformatted display name for a transaction type
 * (e.g. "Account Create Transaction", "Freeze Only"). Apply `short` /
 * `removeTransaction` flags via {@link formatTransactionType}.
 */
export const getRawTransactionType = (input: Exclude<TransactionTypeInput, string>): string => {
  // Backend type input (e.g., from ITransactionNode)
  if (isBackendTypeInput(input)) {
    if (input.backendType === 'FREEZE' && input.freezeType) {
      return getFreezeTypeString(input.freezeType);
    }
    return getTransactionTypeFromBackendType(input.backendType);
  }

  // Local/draft type input — may include bytes for freeze subtype resolution
  if (isLocalTypeInput(input)) {
    const isFreezeType = ['Freeze Transaction', 'FreezeTransaction', 'Freeze', 'FREEZE'].includes(
      input.localType,
    );
    if (isFreezeType && input.transactionBytes) {
      try {
        const bytesArray = input.transactionBytes.split(',').map(n => Number(n));
        const sdkTx = Transaction.fromBytes(new Uint8Array(bytesArray));
        if (sdkTx instanceof FreezeTransaction && sdkTx.freezeType) {
          return getFreezeTypeString(sdkTx.freezeType);
        }
      } catch {
        // Fall through to local type
      }
    }
    return input.localType;
  }

  // SDK Transaction or Uint8Array
  let sdkTransaction = input;
  if (input instanceof Uint8Array) {
    try {
      sdkTransaction = Transaction.fromBytes(input);
    } catch (error) {
      logger.error('Failed to deserialize transaction', { error });
      return 'Unknown Transaction Type';
    }
  }

  if (sdkTransaction instanceof FreezeTransaction && sdkTransaction.freezeType) {
    return getFreezeTypeString(sdkTransaction.freezeType);
  }

  return getTransactionType(sdkTransaction);
};

/**
 * Gets the formatted display transaction type, including specific freeze types.
 * Accepts multiple input formats:
 * - string: Raw display name passed through directly to formatting
 * - SDK Transaction or Uint8Array: Extracts type from transaction, including freeze subtype
 * - { backendType, freezeType? }: Converts backend type (e.g., 'FREEZE') to display format
 * - { localType, transactionBytes? }: Formats local type, extracts freeze subtype if bytes provided
 *
 * @param input - Raw type string, Transaction, Uint8Array, BackendTypeInput, or LocalTypeInput
 * @param short - Whether to use short format (no spaces)
 * @param removeTransaction - Whether to remove " Transaction" suffix
 * @returns Display string for transaction type
 */
export const getDisplayTransactionType = (
  input: TransactionTypeInput,
  short = false,
  removeTransaction = false,
): string => {
  if (typeof input === 'string') {
    return formatTransactionType(input, short, removeTransaction);
  }
  return formatTransactionType(getRawTransactionType(input), short, removeTransaction);
};
