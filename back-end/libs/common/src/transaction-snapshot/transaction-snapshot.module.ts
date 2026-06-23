import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  AccountSnapshot,
  NodeSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
} from '@entities';

import { TransactionSnapshotService } from './transaction-snapshot.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountSnapshot,
      NodeSnapshot,
      TransactionCachedAccount,
      TransactionCachedNode,
    ]),
  ],
  providers: [TransactionSnapshotService],
  exports: [TransactionSnapshotService],
})
export class TransactionSnapshotModule {}
