import { Client } from '@hashgraph/sdk';

import { Network } from '@entities';
import { MirrorNetwork } from '../mirrorNode';

export const getClientFromName = (network: Network) =>
  network !== Network.LOCAL_NODE
    ? Client.forName(network)
    : /* Using host.docker.internal to access the host machine from the container, will work only in dev mode */
      /* Local node will be used only in development mode */
      Client.forNetwork({ 'host.docker.internal:50211': '0.0.3' }).setMirrorNetwork(
        MirrorNetwork.LOCAL_NODE,
      );
