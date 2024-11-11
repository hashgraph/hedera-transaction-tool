import {
  KeyList,
  PublicKey,
  Transaction as SDKTransaction,
  SignatureMap,
  TransactionId,
} from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { MAX_TRANSACTION_BYTE_SIZE, TransactionType, Transaction } from '@entities';
import {
  MirrorNodeService,
  decode,
  getSignatureEntities,
  parseAccountProperty,
  computeShortenedPublicKeyList,
} from '@app/common';

export const isExpired = (transaction: SDKTransaction) => {
  if (!transaction.transactionId?.validStart) {
    return true;
  }

  const validStart = transaction.transactionId.validStart.toDate();
  const duration = transaction.transactionValidDuration;

  return new Date().getTime() >= validStart.getTime() + duration * 1_000;
};

export const getTransactionTypeEnumValue = (transaction: SDKTransaction): TransactionType => {
  const sdkType = transaction.constructor.name
    .slice(transaction.constructor.name.startsWith('_') ? 1 : 0)
    .split(/(?=[A-Z])/)
    .join(' ')
    .replace('Transaction', '')
    .trim()
    .toLocaleUpperCase();

  switch (sdkType) {
    case TransactionType.ACCOUNT_CREATE:
      return TransactionType.ACCOUNT_CREATE;
    case TransactionType.ACCOUNT_UPDATE:
      return TransactionType.ACCOUNT_UPDATE;
    case TransactionType.ACCOUNT_DELETE:
      return TransactionType.ACCOUNT_DELETE;
    case TransactionType.ACCOUNT_ALLOWANCE_APPROVE:
      return TransactionType.ACCOUNT_ALLOWANCE_APPROVE;
    case TransactionType.FILE_CREATE:
      return TransactionType.FILE_CREATE;
    case TransactionType.FILE_APPEND:
      return TransactionType.FILE_APPEND;
    case TransactionType.FILE_UPDATE:
      return TransactionType.FILE_UPDATE;
    case TransactionType.FILE_DELETE:
      return TransactionType.FILE_DELETE;
    case TransactionType.FREEZE:
      return TransactionType.FREEZE;
    case TransactionType.SYSTEM_DELETE:
      return TransactionType.SYSTEM_DELETE;
    case TransactionType.SYSTEM_UNDELETE:
      return TransactionType.SYSTEM_UNDELETE;
    case TransactionType.TRANSFER:
      return TransactionType.TRANSFER;
    case TransactionType.NODE_CREATE:
      return TransactionType.NODE_CREATE;
    case TransactionType.NODE_UPDATE:
      return TransactionType.NODE_UPDATE;
    case TransactionType.NODE_DELETE:
      return TransactionType.NODE_DELETE;
    default:
      throw new Error(`Unsupported transaction type: ${sdkType}`);
  }
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
  const signerPublicKeys: PublicKey[] = [];

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

        if (!alreadySigned) {
          const row = nodeAccountIdRow[nodeAccountId];
          const col = transactionIdCol[transactionId];

          const bodyBytes = transaction._signedTransactions.get(col * rowLength + row).bodyBytes;

          const signatureValid = publicKey.verify(bodyBytes, signature);

          if (signatureValid) {
            signerPublicKeys.push(publicKey);
          } else {
            throw new Error('Invalid signature');
          }
        }
      }
    }
  }

  return signerPublicKeys;
};

export const getStatusCodeFromMessage = (message: string) => {
  if (message.includes('TRANSACTION_EXPIRED')) {
    return 4;
  } else {
    return 21;
  }
};

/* Computes the signature key for the transaction */
export const computeSignatureKey = async (
  transaction: SDKTransaction,
  mirrorNodeService: MirrorNodeService,
  mirrorNetwork: string,
) => {
  /* Get the accounts, receiver accounts and new keys from the transaction */
  const { accounts, receiverAccounts, newKeys } = getSignatureEntities(transaction);

  /* Create a new key list */
  const signatureKey = new KeyList();

  /* Add keys to the signature key list */
  newKeys.forEach(key => signatureKey.push(key));

  /* Add the keys of the account ids to the signature key list */
  for (const accountId of accounts) {
    try {
      const accountInfo = await mirrorNodeService.getAccountInfo(accountId, mirrorNetwork);
      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      signatureKey.push(key);
    } catch (error) {
      console.log(error);
    }
  }

  /* Check if there is a receiver account that required signature, if so add it to the key list */
  for (const accountId of receiverAccounts) {
    try {
      const accountInfo = await mirrorNodeService.getAccountInfo(accountId, mirrorNetwork);
      const receiverSigRequired = parseAccountProperty(accountInfo, 'receiver_sig_required');
      if (!receiverSigRequired) continue;

      const key = parseAccountProperty(accountInfo, 'key');
      if (!key) continue;

      signatureKey.push(key);
    } catch (error) {
      console.log(error);
    }
  }

  return signatureKey;
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
  signature = signature instanceof Buffer ? signature : decode(signature);

  try {
    return publicKey.verify(bodyBytes, signature);
  } catch (err) {
    console.log(err);
    return false;
  }
};

export async function smartCollate(
  transaction: Transaction,
  mirrorNodeService: MirrorNodeService,
): Promise<SDKTransaction | null> {
  const sdkTransaction = SDKTransaction.fromBytes(transaction.transactionBytes);

  if (await isTransactionOverMaxSize(sdkTransaction)) {
    const signatureKey = await computeSignatureKey(
      sdkTransaction,
      mirrorNodeService,
      transaction.mirrorNetwork,
    );

    const publicKeys = computeShortenedPublicKeyList(
      [...sdkTransaction._signerPublicKeys],
      signatureKey,
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
  return proto.Transaction.encode(request).finish().length > MAX_TRANSACTION_BYTE_SIZE;
}

export function isTransactionBodyOverMaxSize(transaction: SDKTransaction) {
  const bodyBytes = getTransactionBodyBytes(transaction);
  return bodyBytes.length > MAX_TRANSACTION_BYTE_SIZE;
}
