import { Module } from '@nestjs/common';
import { ExecuteController } from './execute.controller';
import { ExecuteService } from './execute.service';

@Module({
  controllers: [ExecuteController],
  providers: [ExecuteService],
})
export class ExecuteModule {}
