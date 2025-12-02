import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  LoggerModule,
  MirrorNodeModule,
  NatsModule,
  RedisMurlockModule,
} from '@app/common';
import {
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  Transaction,
  TransactionApprover,
  TransactionComment,
  TransactionGroup,
  TransactionGroupItem,
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
