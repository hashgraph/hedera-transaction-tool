import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey,
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  Transaction,
  TransactionAccount,
  TransactionApprover,
  TransactionComment,
  TransactionGroup,
  TransactionGroupItem,
  TransactionNode,
  TransactionObserver,
  TransactionSigner,
  User,
  UserKey,
} from '@entities';

import { MirrorNodeModule, NatsModule, RedisMurlockModule } from '@app/common';

import { ExecuteService } from './execute.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      UserKey,
      Transaction,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
      TransactionComment,
      TransactionGroup,
      TransactionGroupItem,
      TransactionAccount,
      TransactionNode,
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
      Notification,
      NotificationReceiver,
      NotificationPreferences,
    ]),
    MirrorNodeModule,
    RedisMurlockModule,
    NatsModule.forRoot(),
  ],
  providers: [ExecuteService],
  exports: [ExecuteService],
})
export class ExecuteModule {}
