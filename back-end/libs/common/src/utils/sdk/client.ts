import { Client } from '@hashgraph/sdk';

import { Network } from '.';

export const getClientFromName = (network: Network) => Client.forName(network);
