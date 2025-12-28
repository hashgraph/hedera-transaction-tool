import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import {
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey, Transaction,
  TransactionCachedAccount,
  TransactionCachedNode,
} from '@entities';
import { NatsModule, TransactionSignatureModule } from '@app/common';
import {
  CacheManagementService,
} from '.';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    NatsModule.forRoot(),
    TransactionSignatureModule,
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
      Transaction,
      TransactionCachedAccount,
      TransactionCachedNode,
    ]),
  ],
  providers: [CacheManagementService],
})
export class CacheManagementModule {}