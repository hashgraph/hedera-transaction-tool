import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Notification,
  Transaction,
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
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { JwtOrApiKeyGuard } from '../guards';
import { TransactionGroupsController, TransactionGroupsService } from './groups';
import { CommentsController, CommentsService } from './comments';
import { SignersController, SignersService } from './signers';
import { ObserversController, ObserversService } from './observers';
import { TransactionNodesController } from './nodes/transaction-nodes.controller';
import { TransactionNodesService } from './nodes/transaction-nodes.service';
import { ReviewerAssignmentService } from './reviewer-assignment.service';
import { ReviewersController, ReviewersService } from './reviewers';

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
      TransactionObserver,
      TransactionReviewerList,
      TransactionReviewerListMember,
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
    // JwtOrApiKeyGuard needs ApiKeysService to authenticate a read-only API
    // key inline - see the comment on that guard. The JWT path delegates to
    // JwtAuthGuard/passport's 'jwt' strategy (registered globally by
    // AuthModule), so no local JwtModule or UsersModule import is needed here.
    ApiKeysModule,
  ],
  controllers: [
    TransactionsController,
    CommentsController,
    SignersController,
    ObserversController,
    TransactionGroupsController,
    TransactionNodesController,
    ReviewersController,
  ],
  providers: [
    TransactionsService,
    CommentsService,
    SignersService,
    ObserversService,
    TransactionGroupsService,
    TransactionNodesService,
    ReviewerAssignmentService,
    ReviewersService,
    JwtOrApiKeyGuard,
  ],
  exports: [TransactionsService],
})
export class TransactionsModule {}
