import { Client, Query, Transaction } from '@hashgraph/sdk';

// Deletes the file with stored transactions

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

// Get stored transactions
