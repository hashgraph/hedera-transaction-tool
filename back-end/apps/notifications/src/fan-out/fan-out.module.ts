import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggerModule } from '@app/common';
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

import { FanOutService } from './fan-out.service';

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
  ],
  controllers: [],
  providers: [FanOutService],
  exports: [FanOutService],
})
export class FanOutModule {}
