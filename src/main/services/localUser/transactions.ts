import { Client, Query, Transaction } from '@hashgraph/sdk';
import { Transaction as Tx } from '@prisma/client';
import { getPrismaClient } from '../../db';

const prisma = getPrismaClient();

// Executes a transaction
export const executeTransaction = async (transactionData: string) => {
  const tx: {
    transactionBytes: string;
    network: 'mainnet' | 'testnet' | 'previewnet' | 'custom';
    customNetworkSettings: {
      consensusNodeEndpoint: string;
      mirrorNodeGRPCEndpoint: string;
      mirrorNodeRESTAPIEndpoint: string;
      nodeAccountId: string;
    } | null;
  } = JSON.parse(transactionData);
  const client = getClient();

  const bytesArray = tx.transactionBytes.split(',').map(n => Number(n));

  const transaction = Transaction.fromBytes(Uint8Array.from(bytesArray));

  try {
    const response = await transaction.execute(client);

    const receipt = await response.getReceipt(client);

    return { response, receipt, transactionId: response.transactionId.toString() };
  } catch (error: any) {
    throw new Error(JSON.stringify({ status: error.status._code, message: error.message }));
  }

  function getClient() {
    switch (tx.network) {
      case 'mainnet':
        return Client.forMainnet();
      case 'testnet':
        return Client.forTestnet();
      case 'previewnet':
        return Client.forPreviewnet();
      case 'custom':
        if (tx.customNetworkSettings) {
          const node = {
            [tx.customNetworkSettings.consensusNodeEndpoint]:
              tx.customNetworkSettings.nodeAccountId,
          };

          return Client.forNetwork(node as any).setMirrorNetwork(
            tx.customNetworkSettings.mirrorNodeGRPCEndpoint,
          );
        }
        throw Error('Settings for custom network are required');
      default:
        throw Error('Network not supported');
    }
  }
};

// Executes a query
export const executeQuery = async (queryData: string) => {
  const tx: {
    queryBytes: string;
    network: 'mainnet' | 'testnet' | 'previewnet' | 'custom';
    customNetworkSettings: {
      consensusNodeEndpoint: string;
      mirrorNodeGRPCEndpoint: string;
      mirrorNodeRESTAPIEndpoint: string;
      nodeAccountId: string;
    } | null;
    accountId: string;
    privateKey: string;
  } = JSON.parse(queryData);
  const client = getClient();

  client.setOperator(tx.accountId, tx.privateKey);

  const bytesArray = tx.queryBytes.split(',').map(n => Number(n));

  const transaction = Query.fromBytes(Uint8Array.from(bytesArray));

  try {
    const response = await transaction.execute(client);
    return { response };
  } catch (error: any) {
    console.log(error);
    throw new Error(error.message);
  }

  function getClient() {
    switch (tx.network) {
      case 'mainnet':
        return Client.forMainnet();
      case 'testnet':
        return Client.forTestnet();
      case 'previewnet':
        return Client.forPreviewnet();
      case 'custom':
        if (tx.customNetworkSettings) {
          const node = {
            [tx.customNetworkSettings.consensusNodeEndpoint]:
              tx.customNetworkSettings.nodeAccountId,
          };

          return Client.forNetwork(node as any).setMirrorNetwork(
            tx.customNetworkSettings.mirrorNodeGRPCEndpoint,
          );
        }
        throw Error('Settings for custom network are required');
      default:
        throw Error('Network not supported');
    }
  }
};

// Stores a transaction
export const storeTransaction = async (transaction: Tx) => {
  try {
    const uint8TransactionHash = Uint8Array.from(
      transaction.transaction_hash.split(',').map(b => Number(b)),
    );
    transaction.transaction_hash = Buffer.from(uint8TransactionHash).toString('hex');

    const uint8Body = Uint8Array.from(transaction.body.split(',').map(b => Number(b)));
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
