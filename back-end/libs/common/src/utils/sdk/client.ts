import { AddressBookQuery, Client, FileId, LedgerId } from '@hashgraph/sdk';

import { MirrorNetwork } from '../mirrorNode';

export const MAINNET = 'mainnet';
export const TESTNET = 'testnet';
export const PREVIEWNET = 'previewnet';
export const LOCAL_NODE = 'local-node';

export const getLocalClientNetwork = (env: string) => {
  switch (env) {
    case 'test':
      return { '127.0.0.1:50211': '0.0.3' };
    default:
      return { 'host.docker.internal:50211': '0.0.3' };
  }
};

export const getClientFromNetwork = async (
  mirrorNetwork: string | string[],
  ledgerId?: string | LedgerId,
) => {
  if (!Array.isArray(mirrorNetwork)) {
    mirrorNetwork = [mirrorNetwork];
  }

  mirrorNetwork = mirrorNetwork.map(network => network.toLocaleLowerCase());
  if ([MAINNET, TESTNET, PREVIEWNET].includes(mirrorNetwork[0])) {
    return Client.forName(mirrorNetwork[0]);
  }

  if (mirrorNetwork[0] === LOCAL_NODE) {
    return Client.forNetwork(getLocalClientNetwork(process.env.NODE_ENV)).setMirrorNetwork(
      MirrorNetwork.LOCAL_NODE,
    );
  }

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
