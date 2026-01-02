import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  LoggerModule,
  NatsModule,
  RedisMurlockModule,
  TransactionSignatureModule,
} from '@app/common';
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

import { FanOutModule } from '../fan-out/fan-out.module';

import { ReceiverService } from './receiver.service';
import { ReceiverConsumerService } from './receiver-consumer.service';

@Module({
  imports: [
    LoggerModule,
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
    FanOutModule,
    RedisMurlockModule,
    NatsModule
  ],
  providers: [ReceiverService, ReceiverConsumerService],
})
export class ReceiverModule {}
