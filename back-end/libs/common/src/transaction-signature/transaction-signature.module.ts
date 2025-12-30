import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';

import {
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey,
  TransactionCachedAccount,
  TransactionCachedNode,
} from '@entities';

import {
  AccountCacheService,
  MirrorNodeClient,
  NodeCacheService,
  TransactionSignatureService,
} from '.';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
      TransactionCachedAccount,
      TransactionCachedNode,
    ]),
    HttpModule.register({
      timeout: 5000,
    }),
    ConfigModule,
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