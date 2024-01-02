import { ipcMain, shell } from 'electron';

import { Client, Key, KeyList, Transaction } from '@hashgraph/sdk';
import { proto } from '@hashgraph/proto';

import { hash } from '../../utils/crypto';

const createChannelName = (...props) => ['utils', ...props].join(':');

export default () => {
  ipcMain.on(createChannelName('openExternal'), (e, url: string) => shell.openExternal(url));

  ipcMain.handle(
    createChannelName('decodeProtobuffKey'),
    (e, protobuffEncodedKey: string): Key | KeyList | proto.Key => {
      const buffer = Buffer.from(protobuffEncodedKey, 'hex');
      const key = proto.Key.decode(buffer);

      return key;
    },
  );

  ipcMain.handle(createChannelName('hash'), (e, data: any): string => {
    const hashBuffer = hash(Buffer.from(data));

    const str = hashBuffer.toString('hex');

    return str;
  });

  ipcMain.handle(createChannelName('executeTransaction'), async (e, transactionData: string) => {
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

    const response = await transaction.execute(client);

    const receipt = await response.getReceipt(client);

    return { response, receipt, transactionId: response.transactionId.toString() };

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
