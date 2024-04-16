import { AccountId, PublicKey, Transaction } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { TransactionType } from '@app/common/database/entities';
import { decode, isAccountId } from '@app/common/utils';

export const isExpired = (transaction: Transaction) => {
  if (!transaction.transactionId?.validStart) {
    return true;
  }

  const validStart = transaction.transactionId.validStart.toDate();
  const duration = transaction.transactionValidDuration;

  return new Date().getTime() >= validStart.getTime() + duration * 1_000;
};

export const getTransactionTypeEnumValue = (transaction: Transaction): TransactionType => {
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
    default:
      throw new Error(`Unsupported transaction type: ${sdkType}`);
  }
};

export const validateSignature = (
  transaction: string | Buffer | Transaction,
  nodeAccountId: string | AccountId,
  signature: string | Buffer,
  publicKey: string | PublicKey,
) => {
  /* Deserialize Transaction */
  transaction =
    transaction instanceof Transaction
      ? transaction
      : Transaction.fromBytes(transaction instanceof Buffer ? transaction : decode(transaction));

  /* Deserialize Node Account Id */
  nodeAccountId =
    nodeAccountId instanceof AccountId ? nodeAccountId : AccountId.fromString(nodeAccountId);

  /* Deserialize Public Key */
  publicKey = publicKey instanceof PublicKey ? publicKey : PublicKey.fromString(publicKey);

  /* Deserialize Signature */
  signature = signature instanceof Buffer ? signature : decode(signature);

  // @ts-expect-error - _makeTransactionBody is a private method
  const transactionBody = transaction._makeTransactionBody(nodeAccountId);
  const bodyBytes = proto.TransactionBody.encode(transactionBody).finish();

  try {
    return publicKey.verify(bodyBytes, signature);
  } catch (err) {
    console.log(err);

    return false;
  }
};

export const addTransactionSignatures = (
  transaction: string | Buffer | Transaction,
  signatures: { [key: string]: Buffer },
  publicKey: string | PublicKey,
) => {
  /* Deserialize Transaction */
  transaction =
    transaction instanceof Transaction
      ? transaction
      : Transaction.fromBytes(transaction instanceof Buffer ? transaction : decode(transaction));

  /* Deserialize Public Key */
  publicKey = publicKey instanceof PublicKey ? publicKey : PublicKey.fromString(publicKey);

  /* Validates the signature map */
  if (!isSignatureMap(signatures)) throw new Error('Invalid Signature Map');

  /* Checks the length of the signatures */
  if (Object.values(signatures).length === 0) return;

  /* Freeze the transaction if not frozen */
  if (!transaction.isFrozen()) transaction.freeze();

  const publicKeyHex = publicKey.toStringRaw();

  /* Check if the signature is already added */
  if (transaction._signerPublicKeys.has(publicKeyHex)) return;

  /* Lock the transaction properties */
  // @ts-expect-error - _transactionIds is private property
  transaction._transactionIds.setLocked();
  transaction._nodeAccountIds.setLocked();
  transaction._signedTransactions.setLocked();

  /* Add the signature to each transaction copy for each node */
  for (const subTransaction of transaction._signedTransactions.list) {
    const { nodeAccountID } = proto.TransactionBody.decode(subTransaction.bodyBytes);
    const nodeAccountId = AccountId._fromProtobuf(nodeAccountID);

    let signature = signatures[nodeAccountId.toString()];

    if (!signature) {
      throw new Error(`Signature for Node with Account ID ${nodeAccountId.toString()} Not Found`);
    }
    /* Deserialize Signature */
    signature = signature instanceof Buffer ? signature : decode(signature);

    if (subTransaction.sigMap == null) subTransaction.sigMap = {};

    if (subTransaction.sigMap.sigPair == null) subTransaction.sigMap.sigPair = [];

    subTransaction.sigMap.sigPair.push(publicKey._toProtobufSignature(signature));
  }

  transaction._signerPublicKeys.add(publicKeyHex);
  //@ts-expect-error - _publicKeys is a private property
  transaction._publicKeys.push(publicKey);
  //@ts-expect-error - _transactionSigners is a private property
  transaction._transactionSigners.push(null);
};

export const isSignatureMap = value => {
  if (!value || typeof value !== 'object') return false;

  for (const key in value) {
    if (
      !isAccountId(key) ||
      !value[key] ||
      (typeof value[key] !== 'string' && !(value[key] instanceof Buffer))
    )
      return false;

    if (value[key] instanceof Buffer) continue;
    value[key] = decode(value[key]);
  }
  return true;
};
