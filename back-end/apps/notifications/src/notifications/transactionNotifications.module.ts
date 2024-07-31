import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LoggerModule, MirrorNodeModule } from '@app/common';
import {
  NotificationPreferences,
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

import { TransactionNotificationsController } from './transactionNotifications.controller';
import { TransactionNotificationsService } from './transactionNotifications.service';

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
      NotificationPreferences,
    ]),
    MirrorNodeModule,
  ],
  controllers: [TransactionNotificationsController],
  providers: [TransactionNotificationsService],
})
export class TransactionNotificationsModule {}
