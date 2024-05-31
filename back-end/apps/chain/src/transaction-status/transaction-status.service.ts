import { Inject, Injectable } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import { In, Between, MoreThan, Repository } from 'typeorm';
import {
  FileAppendTransaction,
  FileUpdateTransaction,
  Transaction as SDKTransaction,
} from '@hashgraph/sdk';

import {
  MirrorNodeService,
  NOTIFICATIONS_SERVICE,
  NOTIFY_CLIENT,
  NotifyClientDto,
  TRANSACTION_ACTION,
  ableToSign,
  computeSignatureKey,
} from '@app/common';

import { Transaction, TransactionStatus } from '@entities';

import { UpdateTransactionStatusDto } from './dto';
import { ExecuteService } from '../execute';

@Injectable()
export class TransactionStatusService {
  constructor(
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
    @Inject(NOTIFICATIONS_SERVICE) private readonly notificationsService: ClientProxy,
    private schedulerRegistry: SchedulerRegistry,
    private readonly executeService: ExecuteService,
    private readonly mirrorNodeService: MirrorNodeService,
  ) {}

  /* UPDATES THE TRANSACTIONS STATUSES */

  /* On app start for every transaction */
  @Cron(new Date(Date.now() + 6 * 1000), {
    name: 'initial_status_update',
  })
  async handleInitialTransactionStatusUpdate() {
    /* Valid start now minus 180 seconds */
    const transactions = await this.updateTransactions(this.getValidStartNowMinus180Seconds());

    for (const transaction of transactions.filter(
      t =>
        this.isValidStartExecutable(t.validStart) &&
        t.status === TransactionStatus.WAITING_FOR_EXECUTION,
    )) {
      this.addExecutionTimeout(transaction);
    }
  }

  /* For transactions with valid start after 1 week */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'status_update_after_one_week',
  })
  async handleTransactionsAfterOneWeek() {
    await this.updateTransactions(this.getOneWeekLater());
  }

  /* For transactions with valid start between 1 day and 1 week */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    name: 'status_update_between_one_day_and_one_week',
  })
  async handleTransactionsBetweenOneDayAndOneWeek() {
    await this.updateTransactions(this.getOneDayLater(), this.getOneWeekLater());
  }

  /* For transactions with valid start between 1 hour and 1 day */
  @Cron(CronExpression.EVERY_30_MINUTES, {
    name: 'status_update_between_one_hour_and_one_day',
  })
  async handleTransactionsBetweenOneHourAndOneDay() {
    await this.updateTransactions(this.getOneHourLater(), this.getOneDayLater());
  }

  /* For transactions with valid start between 10 minutes and 1 hour */
  @Cron(CronExpression.EVERY_10_MINUTES, {
    name: 'status_update_between_ten_minutes_and_one_hour',
  })
  async handleTransactionsBetweenTenMinutesAndOneHour() {
    await this.updateTransactions(this.getTenMinutesLater(), this.getOneHourLater());
  }

  /* For transactions with valid start between 3 minutes and 10 minutes */
  @Cron(CronExpression.EVERY_30_SECONDS, {
    name: 'status_update_between_three_minutes_and_10_minutes',
  })
  async handleTransactionsBetweenThreeMinutesAndTenMinutes() {
    await this.updateTransactions(this.getThreeMinutesLater(), this.getTenMinutesLater());
  }

  /* For transactions with valid start, started 3 minutes */
  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'status_update_between_ten_minutes_and_one_hour',
  })
  async handleTransactionsBetweenNowAndAfterThreeMinutes() {
    const transactions = await this.updateTransactions(
      this.getValidStartNowMinus180Seconds(),
      this.getThreeMinutesLater(),
    );

    for (const transaction of transactions.filter(
      t =>
        t.status === TransactionStatus.WAITING_FOR_EXECUTION &&
        this.isValidStartExecutable(t.validStart),
    )) {
      this.addExecutionTimeout(transaction);
    }
  }

  /* Checks if the signers are enough to sign the transactions and update their statuses */
  async updateTransactions(from: Date, to?: Date) {
    const transactions = await this.transactionRepo.find({
      where: {
        status: In([
          TransactionStatus.WAITING_FOR_SIGNATURES,
          TransactionStatus.WAITING_FOR_EXECUTION,
        ]),
        validStart: to ? Between(from, to) : MoreThan(from),
      },
    });

    let atLeastOneUpdated = false;

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
      const sigantureKey = await computeSignatureKey(
        sdkTransaction,
        this.mirrorNodeService,
        transaction.network,
      );

      /* Checks if the transaction has valid siganture */
      const isAbleToSign = ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey);

      const newStatus = isAbleToSign
        ? TransactionStatus.WAITING_FOR_EXECUTION
        : TransactionStatus.WAITING_FOR_SIGNATURES;

      if (transaction.status !== newStatus) {
        try {
          await this.transactionRepo.update(
            {
              id: transaction.id,
            },
            {
              status: newStatus,
            },
          );

          transaction.status = newStatus;
          atLeastOneUpdated = true;
        } catch (error) {
          console.log(error);
        }
      }
    }

    if (atLeastOneUpdated) {
      this.notificationsService.emit<undefined, NotifyClientDto>(NOTIFY_CLIENT, {
        message: TRANSACTION_ACTION,
        content: '',
      });
    }

    return transactions;
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
    const sigantureKey = await computeSignatureKey(
      sdkTransaction,
      this.mirrorNodeService,
      transaction.network,
    );

    /* Checks if the transaction has valid siganture */
    const isAbleToSign = ableToSign([...sdkTransaction._signerPublicKeys], sigantureKey);

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

    this.notificationsService.emit<undefined, NotifyClientDto>(NOTIFY_CLIENT, {
      message: TRANSACTION_ACTION,
      content: '',
    });
  }

  addExecutionTimeout(transaction: Transaction) {
    const name = `execution_timeout_${transaction.id}`;

    if (this.schedulerRegistry.doesExist('timeout', name)) return;

    const timeToValidStart = transaction.validStart.getTime() - Date.now();

    const callback = async () => {
      await this.executeService.executeTransaction(transaction.id);
      this.schedulerRegistry.deleteTimeout(name);
    };

    const timeout = setTimeout(callback, timeToValidStart + 5 * 1_000);
    this.schedulerRegistry.addTimeout(name, timeout);
  }

  private getOneWeekLater() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  private getOneDayLater() {
    return new Date(Date.now() + 1 * 24 * 60 * 60 * 1000);
  }

  private getOneHourLater() {
    return new Date(Date.now() + 1 * 60 * 60 * 1000);
  }

  private getTenMinutesLater() {
    return new Date(Date.now() + 10 * 60 * 1000);
  }

  private getThreeMinutesLater() {
    return new Date(Date.now() + 3 * 60 * 1000);
  }

  private getValidStartNowMinus180Seconds() {
    return new Date(new Date().getTime() - 180 * 1_000);
  }

  private isValidStartExecutable(validStart: Date) {
    const time = validStart.getTime();
    return time < Date.now() && time + 180 * 1_000 > Date.now();
  }
}
