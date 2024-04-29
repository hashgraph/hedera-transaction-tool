import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Transaction,
  TransactionComment,
  TransactionSigner,
  TransactionApprover,
  TransactionObserver,
} from '@app/common/database/entities';

import { MirrorNodeModule } from '@app/common';

import { ExecuteModule } from '../execute';

import { TransactionStatusService } from './transaction-status.service';
import { TransactionStatusController } from './transaction-status.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Transaction,
      TransactionComment,
      TransactionSigner,
      TransactionApprover,
      TransactionObserver,
    ]),
    ExecuteModule,
    MirrorNodeModule,
  ],
  providers: [TransactionStatusService],
  controllers: [TransactionStatusController],
})
export class TransactionStatusModule {}
