import {
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  PublicKey,
  Transaction as SDKTransaction,
  SignatureMap,
  TransactionId,
  AccountCreateTransaction,
  AccountUpdateTransaction,
  AccountDeleteTransaction,
  TransferTransaction,
  AccountAllowanceApproveTransaction,
  FileCreateTransaction,
  FileUpdateTransaction,
  FileAppendTransaction,
  FileDeleteTransaction,
  FreezeTransaction,
  NodeCreateTransaction,
  RegisteredNodeCreateTransaction,
  RegisteredNodeUpdateTransaction,
  RegisteredNodeDeleteTransaction,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  FileContentsQuery,
  KeyList,
  AccountId,
} from '@hiero-ledger/sdk';
import { proto } from '@hiero-ledger/proto';

import {
  TransactionType,
  Transaction,
} from '@entities';
import {
  decode,
  computeShortenedPublicKeyList,
} from '@app/common';
import { getMaxTransactionSizeForTransaction } from './privileged-payer';

export const isExpired = (transaction: SDKTransaction) => {
  if (!transaction.transactionId?.validStart) {
    return true;
  }

  const validStart = transaction.transactionId.validStart.toDate();
  const duration = transaction.transactionValidDuration;

  return new Date().getTime() >= validStart.getTime() + duration * 1_000;
};

export const getTransactionTypeEnumValue = (transaction: SDKTransaction): TransactionType => {
  if (transaction instanceof AccountCreateTransaction) {
    return TransactionType.ACCOUNT_CREATE;
  } else if (transaction instanceof AccountUpdateTransaction) {
    return TransactionType.ACCOUNT_UPDATE;
  } else if (transaction instanceof AccountDeleteTransaction) {
    return TransactionType.ACCOUNT_DELETE;
  } else if (transaction instanceof TransferTransaction) {
    return TransactionType.TRANSFER;
  } else if (transaction instanceof AccountAllowanceApproveTransaction) {
    return TransactionType.ACCOUNT_ALLOWANCE_APPROVE;
  } else if (transaction instanceof FileCreateTransaction) {
    return TransactionType.FILE_CREATE;
  } else if (transaction instanceof FileUpdateTransaction) {
    return TransactionType.FILE_UPDATE;
  } else if (transaction instanceof FileAppendTransaction) {
    return TransactionType.FILE_APPEND;
  } else if (transaction instanceof FileDeleteTransaction) {
    return TransactionType.FILE_DELETE;
  } else if (transaction instanceof FreezeTransaction) {
    return TransactionType.FREEZE;
  } else if (transaction instanceof NodeCreateTransaction) {
    return TransactionType.NODE_CREATE;
  } else if (transaction instanceof NodeUpdateTransaction) {
    return TransactionType.NODE_UPDATE;
  } else if (transaction instanceof NodeDeleteTransaction) {
    return TransactionType.NODE_DELETE;
  } else if (transaction instanceof RegisteredNodeCreateTransaction) {
    return TransactionType.REGISTERED_NODE_CREATE;
  } else if (transaction instanceof RegisteredNodeUpdateTransaction) {
    return TransactionType.REGISTERED_NODE_UPDATE;
  } else if (transaction instanceof RegisteredNodeDeleteTransaction) {
    return TransactionType.REGISTERED_NODE_DELETE;
  } else if (transaction instanceof SystemDeleteTransaction) {
    return TransactionType.SYSTEM_DELETE;
  } else if (transaction instanceof SystemUndeleteTransaction) {
    return TransactionType.SYSTEM_UNDELETE;
  }

  throw new Error(`Unsupported transaction type: ${JSON.stringify(transaction, null, 2)}`);
};

const getSignedTransactionsDimensions = (transaction: SDKTransaction) => {
  const rowLength = transaction._nodeAccountIds.length;
  const columns = transaction._signedTransactions.length / rowLength;

  const nodeAccountIdRow: { [nodeAccountId: string]: number } = {};
  const transactionIdCol: { [transactionId: string]: number } = {};

  for (let row = 0; row < rowLength; row++) {
    const nodeAccountId = transaction._nodeAccountIds.get(row).toString();
    nodeAccountIdRow[nodeAccountId] = row;
  }

  for (let col = 0; col < columns; col++) {
    const bodyBytes = transaction._signedTransactions.get(col * rowLength).bodyBytes;

    if (bodyBytes) {
      const body = proto.TransactionBody.decode(bodyBytes);
      const transactionId = TransactionId._fromProtobuf(body.transactionID).toString();
      transactionIdCol[transactionId] = col;
    }
  }

  return { rowLength, nodeAccountIdRow, transactionIdCol };
};

export const validateSignature = (transaction: SDKTransaction, signatureMap: SignatureMap) => {
  const allPublicKeys: PublicKey[] = [];
  const newPublicKeys: PublicKey[] = [];
  const seenPublicKeys = new Set<string>();

  const { rowLength, nodeAccountIdRow, transactionIdCol } =
    getSignedTransactionsDimensions(transaction);

  for (const [nodeAccountId, transactionIds] of signatureMap._map) {
    for (const [transactionId, publicKeys] of transactionIds._map) {
      for (const [publicKeyDer, signature] of publicKeys._map) {
        const publicKey = PublicKey.fromString(publicKeyDer);
        const publicKeyHex = publicKey.toStringRaw();

        const alreadySigned =
          transaction._signerPublicKeys.has(publicKeyHex) ||
          transaction._signerPublicKeys.has(publicKeyDer);

        const row = nodeAccountIdRow[nodeAccountId];
        const col = transactionIdCol[transactionId];
        if (row === undefined || col === undefined) {
          throw new Error('Invalid signature');
        }

        const bodyBytes = transaction._signedTransactions.get(col * rowLength + row).bodyBytes;
        if (!bodyBytes) {
          throw new Error('Invalid signature');
        }

        let signatureValid: boolean;
        try {
          signatureValid = publicKey.verify(bodyBytes, signature);
        } catch (err) {
          throw Object.assign(new Error('Invalid signature'), { cause: err });
        }

        if (!signatureValid) {
          throw new Error('Invalid signature');
        }

        if (!seenPublicKeys.has(publicKeyHex)) {
          seenPublicKeys.add(publicKeyHex);
          allPublicKeys.push(publicKey);
          if (!alreadySigned) {
            newPublicKeys.push(publicKey);
          }
        }
      }
    }
  }

  return { newPublicKeys, allPublicKeys };
};

export const getStatusCodeFromMessage = (message: string) => {
  if (message.includes('TRANSACTION_EXPIRED')) {
    return 4;
  } else {
    return null;
  }
};

/* Get transaction body bytes without node account id */
export const getTransactionBodyBytes = (transaction: SDKTransaction) => {
  // @ts-expect-error - _makeTransactionBody is a private method
  const transactionBody = transaction._makeTransactionBody(null);
  return proto.TransactionBody.encode(transactionBody).finish();
};

/* Verify the signature of the transaction body without node account id */
export const verifyTransactionBodyWithoutNodeAccountIdSignature = (
  transaction: SDKTransaction,
  signature: string | Buffer,
  publicKey: string | PublicKey,
) => {
  const bodyBytes = getTransactionBodyBytes(transaction);

  /* Deserialize Public Key */
  publicKey = publicKey instanceof PublicKey ? publicKey : PublicKey.fromString(publicKey);

  /* Deserialize Signature */
  signature = typeof signature === 'string' ? decode(signature) : signature;

  try {
    return publicKey.verify(bodyBytes, signature);
  } catch (err) {
    console.log(err);
    return false;
  }
};

export async function smartCollate(
  transaction: Transaction,
  requiredKeys: KeyList,
): Promise<SDKTransaction | null> {
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  // HIP-1300: isTransactionOverMaxSize is fee-payer aware. Privileged payers
  // (0.0.2, 0.0.42-0.0.799) can carry up to 128 KB, so transactions under that
  // limit pass through here untouched and signatures are NOT stripped.
  if (await isTransactionOverMaxSize(sdkTransaction)) {
    const publicKeys = computeShortenedPublicKeyList(
      sdkTransaction._signerPublicKeys,
      requiredKeys,
    );

    const signatureMap = sdkTransaction.getSignatures();
    sdkTransaction.removeAllSignatures();

    for (const key of publicKeys) {
      sdkTransaction.addSignature(key, signatureMap);
    }

    // If the transaction is still too large,
    // set it to failed with the TRANSACTION_OVERSIZE status code
    // update the transaction, emit the event, and delete the timeout
    if (await isTransactionOverMaxSize(sdkTransaction)) {
      return null;
    }
  }

  return sdkTransaction;
}

export async function isTransactionOverMaxSize(transaction: SDKTransaction) {
  // @ts-expect-error _makeRequestAsync is a protected method, this is a temporary solution.
  const request = await transaction._makeRequestAsync();
  // HIP-1300: limit depends on the fee payer (privileged accounts get 128 KB).
  const maxSize = getMaxTransactionSizeForTransaction(transaction);
  return proto.Transaction.encode(request).finish().length > maxSize;
}

export function isTransactionBodyOverMaxSize(transaction: SDKTransaction) {
  const bodyBytes = getTransactionBodyBytes(transaction);
  // HIP-1300: limit depends on the fee payer (privileged accounts get 128 KB).
  const maxSize = getMaxTransactionSizeForTransaction(transaction);
  return bodyBytes.length > maxSize;
}

export const transactionIs = <T extends SDKTransaction>(
  type: new (...args) => T,
  transaction: SDKTransaction,
): transaction is T => {
  return transaction instanceof type;
};

export const isTransactionValidForNodes = (
  sdkTransaction: SDKTransaction,
  allowedNodeAccountIds: Set<string>
): boolean  => {
  const nodeAccountIds = (sdkTransaction as any)._nodeAccountIds;
  const txNodeIds: string[] = [];
  if (
    nodeAccountIds &&
    typeof nodeAccountIds.length === 'number' &&
    typeof nodeAccountIds.get === 'function'
  ) {
    for (let i = 0; i < nodeAccountIds.length; i++) {
      const id = nodeAccountIds.get(i);
      const accountId =
        id instanceof AccountId ? id : AccountId.fromString(String(id));
      txNodeIds.push(accountId.toString());
    }
  }

  return txNodeIds.every((id) => allowedNodeAccountIds.has(id));
};
