import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import { In, MoreThan, Repository } from 'typeorm';
import {
  FileAppendTransaction,
  FileUpdateTransaction,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import { MirrorNodeService, ableToSign, computeSignatureKey } from '@app/common';

import { Transaction, TransactionStatus } from '@entities';

import { UpdateTransactionStatusDto } from './dto';
import { ExecuteService } from '../execute';

@Injectable()
export class TransactionStatusService {
  constructor(
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
    private schedulerRegistry: SchedulerRegistry,
    private readonly executeService: ExecuteService,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* Updates the transaction statuses on app start */
  @Cron(new Date(Date.now() + 1 * 1000), {
    name: 'initial_transactions_status_update',
  })
  async andleInitialTransactionStatusUpdate() {
    console.log('Initial transaction status update');
    await this.updateTransactions();
  }

  /* Updates the transaction statuses every X time */
  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'transactions_status_update',
  })
  async handleCron() {
    console.log('Transactions status update');
    await this.updateTransactions();
  }

  /* Checks if the signers are enough to sign the transaction and update its status */
  async updateTransactionStatus({ id }: UpdateTransactionStatusDto) {
    const transaction = await this.transactionRepo.findOne({ where: { id } });

    /* Returns if the transaction is not found */
    if (!transaction) return;

    /* Gets the SDK transaction from the transaction body */
    const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

    /* Throws an error if the transaction is a file update/append transaction */
    if (
      sdkTransaction instanceof FileUpdateTransaction ||
      sdkTransaction instanceof FileAppendTransaction
    )
      return;

    /* Gets the signature key */
    const sigantureKey = await computeSignatureKey(sdkTransaction, this.mirrorNodeService);

    /* Checks if the transaction has valid siganture */
    const isAbleToSign = !ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey);

    await this.transactionRepo.update(
      {
        id,
      },
      {
        status: isAbleToSign
          ? TransactionStatus.WAITING_FOR_EXECUTION
          : TransactionStatus.WAITING_FOR_SIGNATURES,
      },
    );
  }

  /* Checks if the signers are enough to sign the transactions and update their status */
  async updateTransactions() {
    const transactions = await this.transactionRepo.find({
      where: {
        status:
          In[(TransactionStatus.WAITING_FOR_SIGNATURES, TransactionStatus.WAITING_FOR_EXECUTION)],
        validStart: MoreThan(new Date(new Date().getTime() - 180 * 1_000)),
      },
    });

    for (const transaction of transactions) {
      /* Gets the SDK transaction from the transaction body */
      const sdkTransaction = SDKTransaction.fromBytes(transaction.body);

      /* Throws an error if the transaction is a file update/append transaction */
      if (
        sdkTransaction instanceof FileUpdateTransaction ||
        sdkTransaction instanceof FileAppendTransaction
      )
        continue;

      /* Gets the signature key */
      const sigantureKey = await computeSignatureKey(sdkTransaction, this.mirrorNodeService);

      /* Checks if the transaction has valid siganture */
      const isAbleToSign = ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey);

      await this.transactionRepo.update(
        {
          id: transaction.id,
        },
        {
          status: isAbleToSign
            ? TransactionStatus.WAITING_FOR_EXECUTION
            : TransactionStatus.WAITING_FOR_SIGNATURES,
        },
      );
    }
  }
}
