import { Module } from '@nestjs/common';
import { SqlBuilderService } from './sql-builder.service';

@Module({
  imports: [],
  providers: [SqlBuilderService],
  exports: [SqlBuilderService],
})
export class SqlBuilderModule {}