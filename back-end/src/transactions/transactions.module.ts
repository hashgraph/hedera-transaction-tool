import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../entities/transaction.entity';
import { TransactionComment } from '../entities/transaction-comment.entity';
import { CommentsService } from './comments/comments.service';
import { CommentsController } from './comments/comments.controller';
import { SignersController } from './signers/signers.controller';
import { SignersService } from './signers/signers.service';
import { TransactionSigner } from '../entities/transaction-signer.entity';
import { ObserversController } from './observers/observers.controller';
import { ObserversService } from './observers/observers.service';
import { ApproversController } from './approvers/approvers.controller';
import { ApproversService } from './approvers/approvers.service';
import { TransactionApprover } from '../entities/transaction-approver.entity';
import { TransactionObserver } from '../entities/transaction-observer.entity';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule.register({
      timeout: 5000,
    }),
    TypeOrmModule.forFeature([
      Transaction,
      TransactionComment,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
    ]),
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
