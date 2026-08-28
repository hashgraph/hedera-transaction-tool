import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Notification,
  Transaction,
  TransactionApprover,
  TransactionComment,
  TransactionEntity,
  TransactionGroup,
  TransactionGroupItem,
  TransactionObserver,
  TransactionReviewerList,
  TransactionReviewerListMember,
  TransactionSigner,
  NotificationReceiver,
  TransactionCachedAccount,
  TransactionCachedNode,
  CachedAccount,
  CachedAccountKey,
  CachedNode,
  CachedNodeAdminKey,
  ReviewerGroup,
  ReviewerGroupMember,
  ReviewerRule,
} from '@entities';

import { ExecuteModule, SqlBuilderModule, TransactionSignatureModule } from '@app/common';

import { UserKeysModule } from '../user-keys/user-keys.module';
import { TransactionGroupsController, TransactionGroupsService } from './groups';
import { CommentsController, CommentsService } from './comments';
import { SignersController, SignersService } from './signers';
import { ObserversController, ObserversService } from './observers';
import { ApproversController, ApproversService } from './approvers';
import { TransactionNodesController } from './nodes/transaction-nodes.controller';
import { TransactionNodesService } from './nodes/transaction-nodes.service';
import { ReviewerAssignmentService } from './reviewer-assignment.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionComment,
      TransactionEntity,
      TransactionGroup,
      TransactionGroupItem,
      TransactionReviewerList,
      TransactionReviewerListMember,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
      TransactionCachedAccount,
      TransactionCachedNode,
      CachedAccount,
      CachedAccountKey,
      CachedNode,
      CachedNodeAdminKey,
      Notification,
      NotificationReceiver,
      ReviewerGroup,
      ReviewerGroupMember,
      ReviewerRule,
    ]),
    TransactionSignatureModule,
    UserKeysModule,
    ExecuteModule,
    SqlBuilderModule,
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
    TransactionNodesService,
    ReviewerAssignmentService,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
