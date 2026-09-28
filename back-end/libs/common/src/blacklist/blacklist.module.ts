import { Module } from '@nestjs/common';

import { RedisClientModule } from '../redis/redis-client.module';

import { ConfigurableModuleClass } from './blacklist.module-definition';

import { BlacklistService } from './blacklist.service';

// Pulls in RedisClientModule (global) so BlacklistService's shared connection
// is available wherever this module is imported - that module owns the
// connection's lifecycle, not this one.
@Module({
  imports: [RedisClientModule],
  providers: [BlacklistService],
  exports: [BlacklistService],
})
export class BlacklistModule extends ConfigurableModuleClass {}
