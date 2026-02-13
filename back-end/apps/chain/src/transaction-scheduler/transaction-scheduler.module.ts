import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Transaction,
  TransactionComment,
  TransactionSigner,
  TransactionApprover,
  TransactionObserver,
  TransactionGroup,
  TransactionCachedAccount,
  TransactionCachedNode,
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey,
} from '@entities';

import { ExecuteModule, TransactionSignatureModule } from '@app/common';

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
      TransactionCachedAccount,
      TransactionCachedNode,
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
    ]),
    TransactionSignatureModule,
    ExecuteModule,
  ],
  providers: [TransactionSchedulerService],
})
export class TransactionSchedulerModule {}
