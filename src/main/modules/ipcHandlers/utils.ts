import { ipcMain, shell } from 'electron';

import { Client, Key, KeyList, Query, Transaction } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { hash } from '../../utils/crypto';

const createChannelName = (...props: string[]) => ['utils', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('openExternal'), (_e, url: string) => shell.openExternal(url));

  ipcMain.handle(
    createChannelName('decodeProtobuffKey'),
    (_e, protobuffEncodedKey: string): Key | KeyList | proto.Key => {
      const buffer = Buffer.from(protobuffEncodedKey, 'hex');
      const key = proto.Key.decode(buffer);

      return key;
    },
  );

  ipcMain.handle(createChannelName('hash'), (_e, data): string => {
    const hashBuffer = hash(Buffer.from(data));

    const str = hashBuffer.toString('hex');

    return str;
  });

  ipcMain.handle(createChannelName('executeTransaction'), async (_e, transactionData: string) => {
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
      console.log(error);
      throw new Error(error.message || error);
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
  });

  ipcMain.handle(createChannelName('executeQuery'), async (_e, queryData: string) => {
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
  });
};
