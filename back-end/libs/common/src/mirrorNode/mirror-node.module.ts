import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';

import { LoggerModule } from '@app/common';

import { MirrorNodeService } from './mirror-node.service';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
    }),
    LoggerModule,
  ],
  providers: [MirrorNodeService],
  exports: [MirrorNodeService],
})
export class MirrorNodeModule {}
