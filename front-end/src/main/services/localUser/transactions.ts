import { safeStorage } from 'electron';
import {
  AddressBookQuery,
  Client,
  FileContentsQuery,
  FileId,
  PrivateKey,
  Query,
  Transaction,
} from '@hashgraph/sdk';

import { Prisma } from '@prisma/client';
import { getPrismaClient } from '@main/db/prisma';
import { searchFiles } from '@main/utils/files';

import { HederaSpecialFileId } from '@shared/interfaces';
import { DISPLAY_FILE_SIZE_LIMIT } from '@shared/constants';

import { getKeyPairs } from '@main/services/localUser/keyPairs';
import { showContentInTemp } from '@main/services/localUser/files';
import { getUseKeychainClaim } from '@main/services/localUser/claim';

import { getNumberArrayFromString } from '@main/utils';
import {
  isHederaSpecialFileId,
  decodeProto,
  encodeHederaSpecialFile,
} from '@shared/hederaSpecialFiles';
import { decrypt } from '@main/utils/crypto';
import { getStatusCodeFromMessage } from '@main/utils/sdk';
import fsp from 'fs/promises';
import path from 'path';

let client: Client;

const MAINNET = 'mainnet';
const TESTNET = 'testnet';
const PREVIEWNET = 'previewnet';
const LOCAL_NODE = 'local-node';

export const getClientFromNetwork = async (mirrorNetwork: string | string[], ledgerId?: string) => {
  if (!Array.isArray(mirrorNetwork)) {
    mirrorNetwork = [mirrorNetwork];
  }

  mirrorNetwork = mirrorNetwork.map(network => network.toLocaleLowerCase());

  if ([MAINNET, TESTNET, PREVIEWNET, LOCAL_NODE].includes(mirrorNetwork[0])) {
    return Client.forName(mirrorNetwork[0]);
  }

  mirrorNetwork = mirrorNetwork.map(network =>
    network.endsWith(':443') ? network : `${network}:443`,
  );
  const client = Client.forNetwork({}).setMirrorNetwork(mirrorNetwork);

  const nodeAddressBook = await new AddressBookQuery()
    .setFileId(FileId.ADDRESS_BOOK)
    .execute(client);

  client.setNetworkFromAddressBook(nodeAddressBook);

  if (ledgerId) {
    client.setLedgerId(ledgerId);
  }

  return client;
};

// Sets the client
export const setClient = async (mirrorNetwork: string | string[], ledgerId?: string) => {
  client?.close();
  client = await getClientFromNetwork(mirrorNetwork, ledgerId);
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
  userPassword: string | null,
) => {
  const transaction = Transaction.fromBytes(transactionBytes);

  transaction.freezeWith(client);

  const keyPairs = await getKeyPairs(userId);

  const useKeychain = await getUseKeychainClaim();

  for (let i = 0; i < publicKeys.length; i++) {
    const keyPair = keyPairs.find(kp => kp.public_key === publicKeys[i]);

    if (!keyPair) throw new Error('Required public key not found in local key pairs');

    let decryptedPrivateKey = '';

    if (useKeychain) {
      const buffer = Buffer.from(keyPair.private_key, 'base64');
      decryptedPrivateKey = safeStorage.decryptString(buffer);
    } else if (userPassword) {
      decryptedPrivateKey = decrypt(keyPair.private_key, userPassword);
    } else {
      throw new Error('Password is required to decrypt private key');
    }

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

    return { responseJSON: JSON.stringify(response.toJSON()), receiptBytes: receipt.toBytes() };
  } catch (error: any) {
    let status = error.status?._code || 21;
    if (!error.status) {
      status = getStatusCodeFromMessage(error.message);
    }

    throw new Error(JSON.stringify({ status, message: error.message }));
  }
};

// Executes a query
export const executeQuery = async (
  queryBytes: Uint8Array,
  accountId: string,
  privateKey: string,
  privateKeyType: string,
) => {
  const typedPrivateKey =
    privateKeyType === 'ED25519'
      ? PrivateKey.fromStringED25519(privateKey)
      : privateKeyType === 'ECDSA'
        ? PrivateKey.fromStringECDSA(privateKey)
        : null;

  if (!typedPrivateKey) {
    throw new Error('Invalid key type');
  }

  client.setOperator(accountId, typedPrivateKey);

  const query = Query.fromBytes(queryBytes);

  try {
    const response = await query.execute(client);
    client._operator = null;

    if (query instanceof FileContentsQuery && isHederaSpecialFileId(query.fileId?.toString())) {
      return decodeProto(query.fileId.toString() as HederaSpecialFileId, response as Uint8Array);
    }

    if (
      Buffer.isBuffer(response) &&
      query instanceof FileContentsQuery &&
      response.length > DISPLAY_FILE_SIZE_LIMIT
    ) {
      await showContentInTemp(response, query.fileId?.toString() || '');
    }

    //@ts-expect-error Check if there is a toBytes function
    if (typeof response === 'object' && response !== null && response.toBytes) {
      //@ts-expect-error Invoke toBytes()
      return response.toBytes();
    } else {
      return response;
    }
  } catch (error: unknown) {
    console.log(error);
    client._operator = null;
    throw new Error(error instanceof Error ? error.message : 'Failed to execute query');
  }
};

// Stores a transaction
export const storeTransaction = async (transaction: Prisma.TransactionUncheckedCreateInput) => {
  const prisma = getPrismaClient();

  try {
    const uint8TransactionHash = Uint8Array.from(
      getNumberArrayFromString(transaction.transaction_hash),
    );
    transaction.transaction_hash = Buffer.from(uint8TransactionHash).toString('hex');

    const uint8Body = Uint8Array.from(getNumberArrayFromString(transaction.body));
    transaction.body = Buffer.from(uint8Body).toString('hex');

    return await prisma.transaction.create({
      data: transaction,
    });
  } catch (error: unknown) {
    console.log(error);
    throw new Error(error instanceof Error ? error.message : 'Failed to store transaction');
  }
};

// Get stored transactions
export const getTransactions = async (findArgs: Prisma.TransactionFindManyArgs) => {
  const prisma = getPrismaClient();

  try {
    const transactions = await prisma.transaction.findMany(findArgs);

    transactions.forEach(t => {
      t.body = Uint8Array.from(Buffer.from(t.body, 'hex')).toString();
    });

    return transactions;
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch transactions');
  }
};

// Get stored transactions count
export const getTransactionsCount = async (userId: string) => {
  const prisma = getPrismaClient();

  try {
    const count = await prisma.transaction.count({
      where: {
        user_id: userId,
      },
    });

    return count;
  } catch (error: unknown) {
    throw new Error(error instanceof Error ? error.message : 'Failed to get transactions count');
  }
};

// Get stored transaction by id
export const getTransaction = async (id: string) => {
  const prisma = getPrismaClient();

  try {
    const transaction = await prisma.transaction.findFirst({
      where: {
        id,
      },
    });

    if (!transaction) throw new Error('Transaction not found');

    transaction.body = Uint8Array.from(Buffer.from(transaction.body, 'hex')).toString();

    return transaction;
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? error.message : `Failed to fetch transaction with id: ${id}`,
    );
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
  } catch (error: unknown) {
    console.log(error);
    throw new Error(error instanceof Error ? error.message : 'Failed to encode special file');
  }
};

/* Searches for `.tx` transaction files in the given paths */
export const searchTransactions = async (filePaths: string[]): Promise<TransactionSearchResult[]> => {
  const processFile = async (filePath: string): Promise<string> => Promise.resolve(filePath);
  const selectedPaths = await searchFiles(filePaths, ['.tx', '.csva', '.txt'], processFile);
  return makeTransactionResults(selectedPaths)
};

const makeTransactionResults = async (filePaths: string[]): Promise<TransactionSearchResult[]> => {
  const result: TransactionSearchResult[] = []

  for (const p of filePaths) {
    if (path.extname(p) === ".tx") {
      result.push(await makeTransactionResult(p))
    }
  }

  return Promise.resolve(result)
}

const makeTransactionResult = async (txFilePath: string): Promise<TransactionSearchResult> => {
  const transactionBuffer = await fsp.readFile(txFilePath);
  const transactionBytes = transactionBuffer.toString('hex');
  let transactionCsva: TransactionCsva | null;
  try {
    const csvaFilePath = makeCsvaPath(txFilePath)
    const csvaBuffer = await fsp.readFile(csvaFilePath);
    transactionCsva = JSON.parse(csvaBuffer.toString('utf-8'));
  } catch {
    transactionCsva = null;
  }
  let transactionTxt: TransactionTxt | null;
  try {
    const txtFilePath = makeTxtPath(txFilePath)
    const txtBuffer = await fsp.readFile(txtFilePath);
    transactionTxt = JSON.parse(txtBuffer.toString('utf-8'));
  } catch {
    transactionTxt = null
  }
  const result = { txFilePath, transactionBytes, transactionCsva, transactionTxt }
  return Promise.resolve(result);
}

const makeCsvaPath = (txFilePath: string): string => {
  const baseName = path.basename(txFilePath, '.tx');
  return path.dirname(txFilePath) + path.sep + baseName + '.csva';
}

const makeTxtPath = (txFilePath: string): string => {
  const baseName = path.basename(txFilePath, '.tx');
  return path.dirname(txFilePath) + path.sep + baseName + '.txt';
}


export interface TransactionSearchResult {
  txFilePath: string;
  transactionBytes: string; // Hex encoding
  transactionCsva: TransactionCsva | null;
  transactionTxt: TransactionTxt | null;
}

export interface TransactionCsva {
  nodes: {
    input: string;
    list:
      {
        realmNum: number;
        shardNum: number;
        accountNum: number;
        network: string;
      }[]
  };
}

export interface TransactionTxt {
  "Author": string,
  "Contents":string,
  "Timestamp":string
}

