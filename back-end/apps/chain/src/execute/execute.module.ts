import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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

import { MirrorNodeModule, RedisMurlockModule } from '@app/common';

import { ExecuteController } from './execute.controller';
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
      Notification,
      NotificationReceiver,
      NotificationPreferences,
    ]),
    MirrorNodeModule,
    RedisMurlockModule,
  ],
  controllers: [ExecuteController],
  providers: [ExecuteService],
  exports: [ExecuteService],
})
export class ExecuteModule {}
