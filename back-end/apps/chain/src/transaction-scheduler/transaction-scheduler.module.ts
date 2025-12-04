import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Transaction,
  TransactionComment,
  TransactionSigner,
  TransactionApprover,
  TransactionObserver,
  TransactionGroup,
} from '@app/common/database/entities';

import { ExecuteModule, MirrorNodeModule } from '@app/common';

import { TransactionSchedulerService } from './transaction-scheduler.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionComment,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
      TransactionGroup,
    ]),
    MirrorNodeModule,
    ExecuteModule,
  ],
  providers: [TransactionSchedulerService],
})
export class TransactionSchedulerModule {}
