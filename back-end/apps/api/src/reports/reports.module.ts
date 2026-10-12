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

import { ApiKeysModule } from '../api-keys/api-keys.module';
import { JwtOrApiKeyGuard } from '../guards';

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
    // JwtOrApiKeyGuard needs ApiKeysService to authenticate a read-only API
    // key inline; the JWT path delegates to JwtAuthGuard/passport's 'jwt'
    // strategy (registered globally by AuthModule), so no local JwtModule or
    // UsersModule import is needed here. Paired with ReportAccessGuard to
    // require admin/canViewReports on this controller only.
    ApiKeysModule,
  ],
  controllers: [SigningReportController],
  providers: [SigningReportService, JwtOrApiKeyGuard],
})
export class ReportsModule {}
