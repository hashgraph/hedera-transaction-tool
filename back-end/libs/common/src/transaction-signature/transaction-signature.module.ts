import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

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
  TransactionApprover,
  TransactionCachedAccount,
  TransactionCachedNode,
  TransactionComment,
  TransactionGroup,
  TransactionGroupItem,
  TransactionObserver,
  TransactionSigner,
  User,
  UserKey,
} from '@entities';

import { AccountCacheService } from './account-cache.service';
import { MirrorNodeClient } from './mirror-node.client';
import { NodeCacheService } from './node-cache.service';
import { TransactionSignatureService } from './transaction-signature.service';
import { SqlBuilderModule } from '../sql';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
      Client,
      Notification,
      NotificationPreferences,
      NotificationReceiver,
      Transaction,
      TransactionApprover,
      TransactionCachedAccount,
      TransactionCachedNode,
      TransactionComment,
      TransactionGroup,
      TransactionGroupItem,
      TransactionObserver,
      TransactionSigner,
      User,
      UserKey,
    ], 'cache'),
    HttpModule.register({
      timeout: 5000,
    }),
    ConfigModule,
    SqlBuilderModule,
  ],
  providers: [
    AccountCacheService,
    MirrorNodeClient,
    NodeCacheService,
    TransactionSignatureService,
  ],
  exports: [
    AccountCacheService,
    NodeCacheService,
    TransactionSignatureService,
  ],
})
export class TransactionSignatureModule {}