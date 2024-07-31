import { Client } from '@hashgraph/sdk';

import { Network } from '@entities';
import { MirrorNetwork } from '../mirrorNode';

export const getLocalClientNetwork = (env: string) => {
  switch (env) {
    case 'test':
      return { '127.0.0.1:50211': '0.0.3' };
    default:
      return { 'host.docker.internal:50211': '0.0.3' };
  }
};

export const getClientFromName = (network: Network) => {
  return network !== Network.LOCAL_NODE
    ? Client.forName(network)
    : /* Using host.docker.internal to access the host machine from the container, will work only in dev mode */
      /* Local node will be used only in development mode */
      Client.forNetwork(getLocalClientNetwork(process.env.NODE_ENV)).setMirrorNetwork(
        MirrorNetwork.LOCAL_NODE,
      );
};
