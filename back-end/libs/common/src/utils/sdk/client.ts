import { ConfigService } from '@nestjs/config';
import { Client } from '@hashgraph/sdk';

export const getClientFromConfig = (config: ConfigService) =>
  Client.forName(config.get('HEDERA_NETWORK'));
