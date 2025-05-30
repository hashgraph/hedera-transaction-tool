import * as crypto from 'crypto';

import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountId,
  AccountUpdateTransaction,
  Client,
  FileAppendTransaction,
  FileCreateTransaction,
  FileDeleteTransaction,
  FileUpdateTransaction,
  FreezeTransaction,
  Key,
  Mnemonic,
  NodeCreateTransaction,
  NodeDeleteTransaction,
  NodeUpdateTransaction,
  PrivateKey,
  PublicKey,
  SignatureMap,
  SystemDeleteTransaction,
  SystemUndeleteTransaction,
  Timestamp,
  Transaction,
  TransactionId,
  TransferTransaction,
} from '@hashgraph/sdk';

import { TransactionType } from '@entities';

import { HederaAccount } from './models';

export const localnet2 = new HederaAccount()
  .setAccountId('0.0.2')
  .setPrivateKey(
    '302e020100300506032b65700422042091132178e72057a1d7528025956fe39b0b847f200ab59b2fdd367017f3087137',
  );

export const localnet1002 = new HederaAccount()
  .setAccountId('0.0.1002')
  .setPrivateKey('0x7f109a9e3b0d8ecfba9cc23a3614433ce0fa7ddcc80f2a8f10b222179a5a80d6', 'ECDSA');

export const localnet1003 = new HederaAccount()
  .setAccountId('0.0.1003')
  .setPrivateKey('0x6ec1f2e7d126a74a1d2ff9e1c5d90b92378c725e506651ff8bb8616a5c724628', 'ECDSA');

export const localnet1004 = new HederaAccount()
  .setAccountId('0.0.1004')
  .setPrivateKey('0xb4d7f7e82f61d81c95985771b8abf518f9328d019c36849d4214b5f995d13814', 'ECDSA');

export const localnet1022 = new HederaAccount()
  .setAccountId('0.0.1022')
  .setPrivateKey('0xa608e2130a0a3cb34f86e757303c862bee353d9ab77ba4387ec084f881d420d4', 'ED25519');

export const generateMnemonic = () => {
  return Mnemonic.generate();
};

[localnet2, localnet1002, localnet1003, localnet1004, localnet1022].forEach(account => {
  account.setNetwork('local-node');
});

export const generatePrivateKey = async (mnemonic?: Mnemonic) => {
  mnemonic = mnemonic || (await Mnemonic.generate());

  const index = 1;
  const privateKey = await mnemonic.toStandardECDSAsecp256k1PrivateKey('', index);
  const publicKey = privateKey.publicKey;
  const publicKeyRaw = publicKey.toStringRaw();
  const mnemonicWords = mnemonic.toString();
  const mnemonicHash = crypto.createHash('sha256').update(mnemonicWords).digest('hex');

  return { mnemonic, mnemonicWords, mnemonicHash, privateKey, publicKey, publicKeyRaw, index };
};

export const createTransactionId = (accountId: AccountId, date?: Date) =>
  TransactionId.withValidStart(accountId, Timestamp.fromDate(date || new Date()));

export const getTransactionTypeEnumValue = (transaction: Transaction): TransactionType => {
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

export const createAccount = async (payerId: AccountId, payerKey: PrivateKey, key: Key) => {
  const client = Client.forLocalNode();
  client.setOperator(payerId, payerKey);

  const response = await new AccountCreateTransaction()
    .setTransactionId(createTransactionId(payerId))
    .setKey(key)
    .execute(client);

  const receipt = await response.getReceipt(client);

  client.close();

  return {
    response,
    receipt,
    accountId: receipt.accountId,
  };
};

export const updateAccount = async (
  payerId: AccountId,
  payerKey: PrivateKey,
  accountId: AccountId,
  oldAccountPrivateKey: PrivateKey,
  options: {
    newKey?: PublicKey;
    newKeyPrivateKey?: PrivateKey;
    memo?: string;
    declineStakingReward?: boolean;
    receiverSignatureRequired?: boolean;
  },
) => {
  const client = Client.forLocalNode();
  client.setOperator(payerId, payerKey);

  const transaction = new AccountUpdateTransaction()
    .setTransactionId(createTransactionId(payerId))
    .setAccountId(accountId);

  if (options.newKey && !options.newKeyPrivateKey) {
    throw new Error('newKeyPrivateKey is required when newKey is provided');
  }

  if (options.newKey) {
    transaction.setKey(options.newKey);
  }
  if (options.memo) {
    transaction.setAccountMemo(options.memo);
  }
  if (options.declineStakingReward !== undefined) {
    transaction.setDeclineStakingReward(options.declineStakingReward);
  }
  if (options.receiverSignatureRequired !== undefined) {
    transaction.setReceiverSignatureRequired(options.receiverSignatureRequired);
  }

  transaction.freezeWith(client);
  await transaction.sign(oldAccountPrivateKey);
  if (options.newKey) {
    await transaction.sign(options.newKeyPrivateKey);
  }

  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);

  client.close();

  return {
    response,
    receipt,
  };
};

export const getSignatureMapForPublicKeys = (publicKeys: string[], transaction: Transaction) => {
  const signatureMap = new SignatureMap();
  const allSignatures = transaction.getSignatures();

  const nodeAccountIds = allSignatures.keys();
  for (const nodeAccountId of nodeAccountIds) {
    const transactionIds = allSignatures.get(nodeAccountId)?.keys() || [];

    for (const transactionId of transactionIds) {
      const signatures = allSignatures.get(nodeAccountId)?.get(transactionId);

      if (signatures) {
        for (const publicKeyString of publicKeys) {
          const publicKey = PublicKey.fromString(publicKeyString);

          const signature = signatures.get(publicKey);
          if (signature) {
            signatureMap.addSignature(nodeAccountId, transactionId, publicKey, signature);
          }
        }
      }
    }
  }

  return signatureMap;
};

export const formatSignatureMap = (signatureMap: SignatureMap) => {
  const result: {
    [nodeAccountId: string]: { [transactionId: string]: { [publicKey: string]: string } };
  } = {};
  for (const [nodeAccountId, transactions] of signatureMap._map) {
    result[nodeAccountId] = {};
    for (const [transactionId, signatures] of transactions._map) {
      result[nodeAccountId][transactionId] = {};
      for (const [publicKey, signature] of signatures._map) {
        result[nodeAccountId][transactionId][publicKey] = Buffer.from(signature).toString('hex');
      }
    }
  }
  return result;
};
