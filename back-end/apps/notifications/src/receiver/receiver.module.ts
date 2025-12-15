import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  LoggerModule,
  MirrorNodeModule,
  NatsModule,
  RedisMurlockModule,
} from '@app/common';
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

import { FanOutModule } from '../fan-out/fan-out.module';

import { ReceiverService } from './receiver.service';
import { ReceiverConsumerService } from './receiver-consumer.service';

@Module({
  imports: [
    LoggerModule,
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
    FanOutModule,
    RedisMurlockModule,
    NatsModule
  ],
  providers: [ReceiverService, ReceiverConsumerService],
})
export class ReceiverModule {}
