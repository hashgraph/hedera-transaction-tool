import { Client } from '@hashgraph/sdk';

import { Network } from '@entities';

export const getClientFromName = (network: Network) => Client.forName(network);
