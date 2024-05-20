import { ConfigService } from '@nestjs/config';

import { Client } from '@hashgraph/sdk';

import { Network } from '.';

export const getClientFromConfig = (config: ConfigService) =>
  Client.forName(config.get('HEDERA_NETWORK'));

export const getClientFromName = (network: Network) => Client.forName(network);
