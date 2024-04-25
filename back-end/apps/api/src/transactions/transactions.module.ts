import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  Transaction,
  TransactionApprover,
  TransactionComment,
  TransactionObserver,
  TransactionSigner,
} from '@entities';

import { ChainClientsModule, MirrorNodeModule } from '@app/common';

import { CommentsService } from './comments/comments.service';
import { CommentsController } from './comments/comments.controller';

import { SignersController } from './signers/signers.controller';
import { SignersService } from './signers/signers.service';

import { ObserversController } from './observers/observers.controller';
import { ObserversService } from './observers/observers.service';

import { ApproversController } from './approvers/approvers.controller';
import { ApproversService } from './approvers/approvers.service';

import { UserKeysModule } from '../user-keys/user-keys.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionComment,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
    ]),
    UserKeysModule,
    MirrorNodeModule,
    ChainClientsModule,
  ],
  controllers: [
    TransactionsController,
    CommentsController,
    SignersController,
    ObserversController,
    ApproversController,
  ],
  providers: [
    TransactionsService,
    CommentsService,
    SignersService,
    ObserversService,
    ApproversService,
  ],
})
export class TransactionsModule {}
