import { Module } from '@nestjs/common';

import { HederaClientPool } from './hedera-client-pool.service';

@Module({
  providers: [HederaClientPool],
  exports: [HederaClientPool],
})
export class HederaClientPoolModule {}
