import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey,
  Client,
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  Transaction,
  TransactionCachedAccount,
  TransactionApprover,
  TransactionComment,
  TransactionGroup,
  TransactionGroupItem,
  TransactionCachedNode,
  TransactionObserver,
  TransactionSigner,
  User,
  UserKey,
} from '@entities';

import { NatsModule, RedisMurlockModule, TransactionSignatureModule, TransactionSnapshotModule } from '@app/common';

import { ExecuteService } from './execute.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserKey,
      Client,
      Transaction,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
      TransactionComment,
      TransactionGroup,
      TransactionGroupItem,
      TransactionCachedAccount,
      TransactionCachedNode,
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
      Notification,
      NotificationReceiver,
      NotificationPreferences,
    ]),
    TransactionSignatureModule,
    RedisMurlockModule,
    NatsModule.forRoot(),
    TransactionSnapshotModule,
  ],
  providers: [ExecuteService],
  exports: [ExecuteService, TransactionSnapshotModule],
})
export class ExecuteModule {}
