import { Client, FileContentsQuery, PrivateKey, Query, Transaction } from '@hashgraph/sdk';

import { Transaction as Tx } from '@prisma/client';
import { getPrismaClient } from '@main/db';

import { getNumberArrayFromString } from '@main/utils';
import {
  HederaSpecialFileId,
  isHederaSpecialFileId,
  decodeProto,
  encodeHederaSpecialFile,
} from '@main/shared/utils/hederaSpecialFiles';

import { getKeyPairs } from '@main/services/localUser/keyPairs';
import { decrypt } from '@main/utils/crypto';

let client: Client;

// Sets the client
export const setClient = (
  network: string,
  nodeAccountIds?: {
    [key: string]: string;
  },
  mirrorNetwork?: string[],
) => {
  switch (network) {
    case 'mainnet':
      client = Client.forMainnet();
      break;
    case 'testnet':
      client = Client.forTestnet();
      break;

    case 'previewnet':
      client = Client.forPreviewnet();
      break;

    case 'custom':
      if (!nodeAccountIds || !mirrorNetwork) {
        throw Error('Settings for custom network are required');
      }
      client = Client.forNetwork(nodeAccountIds).setMirrorNetwork(mirrorNetwork);
      break;
    default:
      throw Error('Network not supported');
  }
};

// Gets the client
export const getClient = () => {
  return client;
};

// Freezes a transaction
export const freezeTransaction = async (transactionBytes: Uint8Array) => {
  const transaction = Transaction.fromBytes(transactionBytes);

  transaction.freezeWith(client);

  return transaction.toBytes();
};

// Signs a transaction
export const signTransaction = async (
  transactionBytes: Uint8Array,
  publicKeys: string[],
  userId: string,
  userPassword: string,
) => {
  const transaction = Transaction.fromBytes(transactionBytes);

  transaction.freezeWith(client);

  const keyPairs = await getKeyPairs(userId);

  for (let i = 0; i < publicKeys.length; i++) {
    const keyPair = keyPairs.find(kp => kp.public_key === publicKeys[i]);

    if (!keyPair) throw new Error('Required public key not found in local key pairs');

    const decryptedPrivateKey = decrypt(keyPair.private_key, userPassword);
    const startsWithHex = decryptedPrivateKey.startsWith('0x');

    const privateKey =
      keyPair.type === 'ECDSA'
        ? PrivateKey.fromStringECDSA(`${startsWithHex ? '' : '0x'}${decryptedPrivateKey}`)
        : PrivateKey.fromStringED25519(decryptedPrivateKey);

    await transaction.sign(privateKey);
  }

  return transaction.toBytes();
};

// Executes a transaction
export const executeTransaction = async (transactionBytes: Uint8Array) => {
  const transaction = Transaction.fromBytes(transactionBytes);

  try {
    const response = await transaction.execute(client);

    const receipt = await response.getReceipt(client);

    return { response, receipt, transactionId: response.transactionId.toString() };
  } catch (error: any) {
    console.log(error);

    throw new Error(JSON.stringify({ status: error?.status?._code || -1, message: error.message }));
  }
};

// Executes a query
export const executeQuery = async (queryData: string) => {
  const tx: {
    queryBytes: string;
    accountId: string;
    privateKey: string;
    type: string;
  } = JSON.parse(queryData);

  const privateKey =
    tx.type === 'ED25519'
      ? PrivateKey.fromStringED25519(tx.privateKey)
      : tx.type === 'ECDSA'
        ? PrivateKey.fromStringECDSA(tx.privateKey)
        : null;

  if (!privateKey) {
    throw new Error('Invalid key type');
  }

  client.setOperator(tx.accountId, privateKey);

  const bytesArray = getNumberArrayFromString(tx.queryBytes);

  const query = Query.fromBytes(Uint8Array.from(bytesArray));

  try {
    const response = await query.execute(client);

    if (query instanceof FileContentsQuery && isHederaSpecialFileId(query.fileId?.toString())) {
      const decoded = decodeProto(query.fileId.toString() as HederaSpecialFileId, response);
      return { response: decoded };
    }
    return { response };
  } catch (error: any) {
    console.log(error);
    throw new Error(error.message);
  } finally {
    client._operator = null;
  }
};

// Stores a transaction
export const storeTransaction = async (transaction: Tx) => {
  const prisma = getPrismaClient();

  try {
    const uint8TransactionHash = Uint8Array.from(
      getNumberArrayFromString(transaction.transaction_hash),
    );
    transaction.transaction_hash = Buffer.from(uint8TransactionHash).toString('hex');

    const uint8Body = Uint8Array.from(getNumberArrayFromString(transaction.body));
    transaction.body = Buffer.from(uint8Body).toString('hex');

    return await prisma.transaction.create({
      data: {
        ...transaction,
        id: undefined,
        created_at: undefined,
        updated_at: undefined,
      },
    });
  } catch (error: any) {
    console.log(error);
    throw new Error(error.message || 'Failed to store transaction');
  }
};

// Get stored transactions
export const getTransactions = async (user_id: string) => {
  const prisma = getPrismaClient();

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        user_id: user_id,
      },
    });

    transactions.forEach(t => {
      t.body = Uint8Array.from(Buffer.from(t.body, 'hex')).toString();
    });

    return transactions;
  } catch (error: any) {
    console.log(error);
    throw new Error(error.message || 'Failed to fetch transactions');
  }
};

// Encode Special File
export const encodeSpecialFile = async (content: Uint8Array, fileId: string) => {
  try {
    if (isHederaSpecialFileId(fileId)) {
      return encodeHederaSpecialFile(content, fileId);
    } else {
      throw new Error('File is not one of special files');
    }
  } catch (error: any) {
    console.log(error);
    throw new Error(error.message || 'Failed to fetch transactions');
  }
};
