import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  AccountSnapshot,
  NodeSnapshot,
  TransactionAccountSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionNodeSnapshot,
} from '@entities';

import { TransactionSnapshotService } from './transaction-snapshot.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountSnapshot,
      NodeSnapshot,
      TransactionAccountSnapshot,
      TransactionCachedAccount,
      TransactionCachedNode,
      TransactionNodeSnapshot,
    ]),
  ],
  providers: [TransactionSnapshotService],
  exports: [TransactionSnapshotService],
})
export class TransactionSnapshotModule {}
