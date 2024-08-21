import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggerModule, MirrorNodeModule, RedisMurlockModule } from '@app/common';
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

import { ReceiverController } from './receiver.controller';
import { ReceiverService } from './receiver.service';
import { FanOutModule } from '../fan-out/fan-out.module';

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
  ],
  controllers: [ReceiverController],
  providers: [ReceiverService],
})
export class ReceiverModule {}
