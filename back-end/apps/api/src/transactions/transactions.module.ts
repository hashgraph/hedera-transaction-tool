import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Notification,
  Transaction,
  TransactionApprover,
  TransactionComment,
  TransactionGroup,
  TransactionGroupItem,
  TransactionObserver,
  TransactionSigner,
  NotificationReceiver,
} from '@entities';

import { ExecuteModule, MirrorNodeModule } from '@app/common';

import { UserKeysModule } from '../user-keys/user-keys.module';
import { TransactionGroupsController, TransactionGroupsService } from './groups';
import { CommentsController, CommentsService } from './comments';
import { SignersController, SignersService } from './signers';
import { ObserversController, ObserversService } from './observers';
import { ApproversController, ApproversService } from './approvers';
import { TransactionNodesController } from './nodes/transaction-nodes.controller';
import { TransactionNodesService } from './nodes/transaction-nodes.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionComment,
      TransactionGroup,
      TransactionGroupItem,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
      Notification,
      NotificationReceiver,
    ]),
    MirrorNodeModule,
    UserKeysModule,
    ExecuteModule,
  ],
  controllers: [
    TransactionsController,
    CommentsController,
    SignersController,
    ObserversController,
    ApproversController,
    TransactionGroupsController,
    TransactionNodesController
  ],
  providers: [
    TransactionsService,
    CommentsService,
    SignersService,
    ObserversService,
    ApproversService,
    TransactionGroupsService,
    TransactionNodesService
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
