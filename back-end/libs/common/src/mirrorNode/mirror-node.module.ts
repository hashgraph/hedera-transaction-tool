import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';

import { LoggerModule } from '@app/common';

import { MirrorNodeService } from './mirror-node.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
    }),
    LoggerModule,
    CacheModule.register({ isGlobal: true }),
  ],
  providers: [MirrorNodeService],
  exports: [MirrorNodeService],
})
export class MirrorNodeModule {}
