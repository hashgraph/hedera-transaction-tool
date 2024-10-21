import { Module } from '@nestjs/common';

import { ConfigurableModuleClass } from './blacklist.module-definition';

import { BlacklistService } from './blacklist.service';

@Module({
  imports: [],
  providers: [BlacklistService],
  exports: [BlacklistService],
})
export class BlacklistModule extends ConfigurableModuleClass {}
