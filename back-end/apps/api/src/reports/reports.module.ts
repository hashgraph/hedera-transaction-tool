import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Transaction,
  TransactionAccountSnapshot,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionGroup,
  TransactionGroupItem,
  TransactionNodeSnapshot,
  TransactionSigner,
  UserKey,
} from '@entities';

import { SigningReportController } from './signing-report.controller';
import { SigningReportService } from './signing-report.service';

@Module({
  imports: [
    // Only the entities whose repositories SigningReportService injects. The
    // related entities loaded via relations (AccountSnapshot, NodeSnapshot,
    // CachedAccount/Key, CachedNode/AdminKey) are registered on the default
    // connection by TransactionSnapshotModule and TransactionsModule, so they
    // don't need to be listed here.
    TypeOrmModule.forFeature([
      Transaction,
      TransactionAccountSnapshot,
      TransactionCachedAccount,
      TransactionCachedNode,
      TransactionGroup,
      TransactionGroupItem,
      TransactionNodeSnapshot,
      TransactionSigner,
      UserKey,
    ]),
  ],
  controllers: [SigningReportController],
  providers: [SigningReportService],
})
export class ReportsModule {}
