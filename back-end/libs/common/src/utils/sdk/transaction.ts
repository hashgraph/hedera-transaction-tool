import {
  KeyList,
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
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  FileContentsQuery,
} from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { MAX_TRANSACTION_BYTE_SIZE, TransactionType, Transaction } from '@entities';
import {
  MirrorNodeService,
  decode,
  getSignatureEntities,
  computeShortenedPublicKeyList,
  parseAccountInfo,
  parseNodeInfo,
  safeAwait,
  COUNCIL_ACCOUNTS,
} from '@app/common';

export const isExpired = (transaction: SDKTransaction) => {
  if (!transaction.transactionId?.validStart) {
    return true;
  }

  const validStart = transaction.transactionId.validStart.toDate();
  const duration = transaction.transactionValidDuration;

  return new Date().getTime() >= validStart.getTime() + duration * 1_000;
};

export const getTransactionType = (
  transaction: SDKTransaction | Uint8Array,
  short = false,
  removeTransaction = false,
) => {
  if (transaction instanceof Uint8Array) {
    transaction = SDKTransaction.fromBytes(transaction);
  }

  let transactionType = 'Unknown Transaction Type';

  if (transaction instanceof AccountCreateTransaction) {
    transactionType = "Account Create Transaction";
  } else if (transaction instanceof AccountUpdateTransaction) {
    transactionType = "Account Update Transaction";
  } else if (transaction instanceof AccountDeleteTransaction) {
    transactionType = "Account Delete Transaction";
  } else if (transaction instanceof TransferTransaction) {
    transactionType = "Transfer Transaction";
  } else if (transaction instanceof AccountAllowanceApproveTransaction) {
    transactionType = "Account Allowance Approve Transaction";
  } else if (transaction instanceof FileCreateTransaction) {
    transactionType = "File Create Transaction";
  } else if (transaction instanceof FileUpdateTransaction) {
    transactionType = "File Update Transaction";
  } else if (transaction instanceof FileAppendTransaction) {
    transactionType = "File Append Transaction";
  } else if (transaction instanceof FileDeleteTransaction) {
    transactionType = "File Delete Transaction";
  } else if (transaction instanceof FileContentsQuery) {
    transactionType = "Read File Query";
  } else if (transaction instanceof FreezeTransaction) {
    transactionType = "Freeze Transaction";
  } else if (transaction instanceof NodeCreateTransaction) {
    transactionType = "Node Create Transaction";
  } else if (transaction instanceof NodeUpdateTransaction) {
    transactionType = "Node Update Transaction";
  } else if (transaction instanceof NodeDeleteTransaction) {
    transactionType = "Node Delete Transaction";
  } else if (transaction instanceof SystemDeleteTransaction) {
    transactionType = "System Delete Transaction";
  } else if (transaction instanceof SystemUndeleteTransaction) {
    transactionType = "System Undelete Transaction";
    // } else if (transaction instanceof ContractCallTransaction) {
    //   transactionType = 'ContractCallTransaction';
    // } else if (transaction instanceof ContractCreateTransaction) {
    //   transactionType = 'ContractCreateTransaction';
    // } else if (transaction instanceof ContractDeleteTransaction) {
    //   transactionType = 'ContractDeleteTransaction';
    // } else if (transaction instanceof ContractUpdateTransaction) {
    //   transactionType = 'ContractUpdateTransaction';
    // } else if (transaction instanceof ScheduleCreateTransaction) {
    //   transactionType = 'ScheduleCreateTransaction';
    // } else if (transaction instanceof ScheduleDeleteTransaction) {
    //   transactionType = 'ScheduleDeleteTransaction';
    // } else if (transaction instanceof ScheduleSignTransaction) {
    //   transactionType = 'ScheduleSignTransaction';
    // } else if (transaction instanceof TokenAssociateTransaction) {
    //   transactionType = 'TokenAssociateTransaction';
    // } else if (transaction instanceof TokenBurnTransaction) {
    //   transactionType = 'TokenBurnTransaction';
    // } else if (transaction instanceof TokenCreateTransaction) {
    //   transactionType = 'TokenCreateTransaction';
    // } else if (transaction instanceof TokenDeleteTransaction) {
    //   transactionType = 'TokenDeleteTransaction';
    // } else if (transaction instanceof TokenFeeScheduleUpdateTransaction) {
    //   transactionType = 'TokenFeeScheduleUpdateTransaction';
    // } else if (transaction instanceof TokenFreezeTransaction) {
    //   transactionType = 'TokenFreezeTransaction';
    // } else if (transaction instanceof TokenGrantKycTransaction) {
    //   transactionType = 'TokenGrantKycTransaction';
    // } else if (transaction instanceof TokenMintTransaction) {
    //   transactionType = 'TokenMintTransaction';
    // } else if (transaction instanceof TokenPauseTransaction) {
    //   transactionType = 'TokenPauseTransaction';
    // } else if (transaction instanceof TokenRevokeKycTransaction) {
    //   transactionType = 'TokenRevokeKycTransaction';
    // } else if (transaction instanceof TokenUnfreezeTransaction) {
    //   transactionType = 'TokenUnfreezeTransaction';
    // } else if (transaction instanceof TokenUnpauseTransaction) {
    //   transactionType = 'TokenUnpauseTransaction';
    // } else if (transaction instanceof TokenUpdateTransaction) {
    //   transactionType = 'TokenUpdateTransaction';
    // } else if (transaction instanceof TopicCreateTransaction) {
    //   transactionType = 'TopicCreateTransaction';
    // } else if (transaction instanceof TopicDeleteTransaction) {
    //   transactionType = 'TopicDeleteTransaction';
    // } else if (transaction instanceof TopicMessageSubmitTransaction) {
    //   transactionType = 'TopicMessageSubmitTransaction';
    // } else if (transaction instanceof TopicUpdateTransaction) {
    //   transactionType = 'TopicUpdateTransaction';
  }

  if (removeTransaction) {
    // Remove ' Transaction' only if it appears at the end
    transactionType = transactionType.replace(/ Transaction$/, '');
  }
  if (short) {
    // Remove all whitespace characters
    transactionType = transactionType.replace(/\s+/g, '');
  }
  return transactionType;
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
  const { accounts, receiverAccounts, newKeys, nodeId } = getSignatureEntities(transaction);

  /* Create a new key list */
  const signatureKey = new KeyList();

  /* Add keys to the signature key list */
  newKeys.forEach(key => signatureKey.push(key));

  /* Get the keys of the account ids to the signature key list */
  for (const accountId of accounts) {
    try {
      const accountInfo = parseAccountInfo(
        await mirrorNodeService.getAccountInfo(accountId, mirrorNetwork),
      );
      if (!accountInfo.key) continue;
      signatureKey.push(accountInfo.key);
    } catch (error) {
      console.log(error);
    }
  }

  /* Check if there is a receiver account that required signature, if so get it */
  for (const accountId of receiverAccounts) {
    try {
      const accountInfo = parseAccountInfo(
        await mirrorNodeService.getAccountInfo(accountId, mirrorNetwork),
      );
      if (!accountInfo.receiverSignatureRequired || !accountInfo.key) continue;
      signatureKey.push(accountInfo.key);
    } catch (error) {
      console.log(error);
    }
  }

  /* Check if user has a key included in the node admin key */
  try {
    if (!isNaN(nodeId) && nodeId !== null) {
      const nodeInfo = parseNodeInfo(await mirrorNodeService.getNodeInfo(nodeId, mirrorNetwork));
      const nodeSignatureKey = new KeyList();

      if (nodeInfo.admin_key) {
        nodeSignatureKey.push(nodeInfo.admin_key);
      }

      if (transactionIs(NodeUpdateTransaction, transaction)) {
        const nodeAccountId = nodeInfo?.node_account_id?.toString() || null;
        if (transaction.accountId && nodeAccountId) {
          const accountInfo = parseAccountInfo(
            await mirrorNodeService.getAccountInfo(nodeAccountId, mirrorNetwork),
          );
          if (accountInfo?.key) {
            nodeSignatureKey.push(accountInfo.key);
          }
        }
      }

      if (transactionIs(NodeDeleteTransaction, transaction)) {
        for (const acc of COUNCIL_ACCOUNTS) {
          const res = await safeAwait(mirrorNodeService.getAccountInfo(acc, mirrorNetwork));
          if (res.data) {
            const councilAccountInfo = parseAccountInfo(res.data);
            nodeSignatureKey.push(councilAccountInfo.key);
          }
        }
        nodeSignatureKey.setThreshold(1);
      }

      signatureKey.push(nodeSignatureKey);
    }
  } catch (error) {
    console.log(error);
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

export const transactionIs = <T extends SDKTransaction>(
  type: new (...args) => T,
  transaction: SDKTransaction,
): transaction is T => {
  return transaction instanceof type;
};
