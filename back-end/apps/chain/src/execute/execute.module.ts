import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import {
  Transaction,
  TransactionApprover,
  TransactionComment,
  TransactionObserver,
  TransactionSigner,
  User,
  UserKey,
} from '@entities';

import { ExecuteController } from './execute.controller';
import { ExecuteService } from './execute.service';
import { MirrorNodeModule } from '@app/common';

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
    ]),
    MirrorNodeModule,
  ],
  controllers: [ExecuteController],
  providers: [ExecuteService],
})
export class ExecuteModule {}
