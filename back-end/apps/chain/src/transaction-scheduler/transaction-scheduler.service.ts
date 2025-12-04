import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression, SchedulerRegistry } from '@nestjs/schedule';

import { In, Between, MoreThan, Repository, LessThan } from 'typeorm';
import { Status } from '@hashgraph/sdk';

import {
  MirrorNodeService,
  ExecuteService,
  smartCollate,
  emitTransactionStatusUpdate,
  processTransactionStatus,
  NatsPublisherService,
} from '@app/common';
import {
  Transaction,
  TransactionGroup,
  TransactionStatus
} from '@entities';

@Injectable()
export class TransactionSchedulerService {
  constructor(
    @InjectRepository(Transaction) private transactionRepo: Repository<Transaction>,
    @InjectRepository(TransactionGroup) private transactionGroupRepo: Repository<TransactionGroup>,
    private readonly notificationsPublisher: NatsPublisherService,
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
    const transactions = await this.updateTransactions(this.getThreeMinutesBefore());

    await this.prepareTransactions(transactions);
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

  /* For transactions with valid start between currently valid and 3 minutes */
  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'status_update_between_now_and_three_minutes',
  })
  async handleTransactionsBetweenNowAndAfterThreeMinutes() {
    const transactions = await this.updateTransactions(
      this.getThreeMinutesBefore(),
      this.getThreeMinutesLater(),
    );

    await this.prepareTransactions(transactions);
  }

  /* For transactions that are expired */
  @Cron(CronExpression.EVERY_10_SECONDS, {
    name: 'status_update_expired_transactions',
  })
  async handleExpiredTransactions() {
    await this.transactionRepo.manager.transaction(async transactionalEntityManager => {
      const transactions = await transactionalEntityManager.find(Transaction, {
        where: {
          status: In([
            TransactionStatus.NEW,
            TransactionStatus.REJECTED,
            TransactionStatus.WAITING_FOR_EXECUTION,
            TransactionStatus.WAITING_FOR_SIGNATURES,
          ]),
          validStart: LessThan(this.getThreeMinutesBefore()),
        },
        select: { id: true, mirrorNetwork: true },
      });

      for (const transaction of transactions) {
        await transactionalEntityManager.update(
          Transaction,
          { id: transaction.id },
          { status: TransactionStatus.EXPIRED },
        );
      }

      if (transactions.length > 0) {
        emitTransactionStatusUpdate(this.notificationsPublisher, transactions.map(t => ({
          entityId: t.id,
          additionalData: {
            transactionId: t.transactionId,
            network: t.mirrorNetwork,
          },
        })));
      }
    });
  }

  /* Checks if the signers are enough to sign the transactions and update their statuses */
  async updateTransactions(from: Date, to?: Date) {
    //Get the transaction, creatorKey, groupItem, and group. We need the group info upfront
    //in order to determine if the group needs to be processed together
    const transactions = await this.transactionRepo.find({
      where: {
        status: In([
          TransactionStatus.WAITING_FOR_SIGNATURES,
          TransactionStatus.WAITING_FOR_EXECUTION,
        ]),
        validStart: to ? Between(from, to) : MoreThan(from),
      },
      relations: {
        creatorKey: true,
        groupItem: {
          group: true,
        },
      },
      order: {
        validStart: 'ASC',
      },
    });

    const results = await processTransactionStatus(this.transactionRepo, this.mirrorNodeService, transactions);

    if (results.size > 0) {
      const events = Array.from(results.keys(), id => ({ entityId: id }));
      emitTransactionStatusUpdate(this.notificationsPublisher, events);
    }

    return transactions;
  }

  async prepareTransactions(transactions: Transaction[]) {
    const processedGroupIds = new Set<number>();

    for (const transaction of transactions) {
      const waitingForExecution = transaction.status === TransactionStatus.WAITING_FOR_EXECUTION;

      if (waitingForExecution && this.isValidStartExecutable(transaction.validStart)) {
        if (transaction.groupItem && (transaction.groupItem.group.atomic || transaction.groupItem.group.sequential)) {
          if (!processedGroupIds.has(transaction.groupItem.groupId)) {
            processedGroupIds.add(transaction.groupItem.groupId);
            // Now that we are sure this transaction group needs to be processed together, get it
            // and being the processing
            const transactionGroup = await this.transactionGroupRepo.findOne({
              where: { id: transaction.groupItem.groupId },
              relations: {
                groupItems: {
                  transaction: true,
                },
              },
              order: {
                groupItems: {
                  transaction: {
                    validStart: 'ASC',
                  },
                },
              },
            });
            // All the transactions for the group are now pulled. If there is an issue validating for even one
            // transaction, the group will not be executed. This is handled in executeTransactionGroup
            this.collateGroupAndExecute(transactionGroup);
          }
        } else {
          this.collateAndExecute(transaction);
        }
      }
    }
  }

  collateGroupAndExecute(transactionGroup: TransactionGroup) {
    const name = `smart_collate_group_timeout_${transactionGroup.id}`;

    if (this.schedulerRegistry.doesExist('timeout', name)) return;

    const timeToValidStart =
      transactionGroup.groupItems[0].transaction.validStart.getTime() - Date.now();

    const callback = async () => {
      try {
        let smartCollateFailed = false;
        for (const groupItem of transactionGroup.groupItems) {
          const transaction = groupItem.transaction;
          const sdkTransaction = await smartCollate(transaction, this.mirrorNodeService);

          // If the transaction is still too large,
          // break out of the loop and update all transactions in the group to failed
          // with the TRANSACTION_OVERSIZE status code.
          // This should happen on the first transaction, if at all
          if (sdkTransaction === null) {
            smartCollateFailed = true;
            break;
          }

          //NOTE: the transactionBytes are set here but are not to be saved. Otherwise,
          // any signatures that were removed in order to make the transaction fit
          // would be lost.
          transaction.transactionBytes = Buffer.from(sdkTransaction.toBytes());
        }

        if (smartCollateFailed) {
          for (const groupItem of transactionGroup.groupItems) {
            await this.transactionRepo.update(
              {
                id: groupItem.transaction.id,
              },
              {
                status: TransactionStatus.FAILED,
                executedAt: new Date(),
                statusCode: Status.TransactionOversize._code,
              },
            );
          }

          emitTransactionStatusUpdate(
            this.notificationsPublisher,
            transactionGroup.groupItems.map(gi => ({ entityId: gi.transaction.id })),
          );
          return;
        }

        this.addGroupExecutionTimeout(transactionGroup);
      } catch (error) {
        console.log(error);
      } finally {
        this.schedulerRegistry.deleteTimeout(name);
      }
    };

    const timeout = setTimeout(callback, timeToValidStart - 10 * 1_000);
    this.schedulerRegistry.addTimeout(name, timeout);
  }

  collateAndExecute(transaction: Transaction) {
    const name = `smart_collate_timeout_${transaction.id}`;

    if (this.schedulerRegistry.doesExist('timeout', name)) return;

    const timeToValidStart = transaction.validStart.getTime() - Date.now();

    const callback = async () => {
      try {
        const sdkTransaction = await smartCollate(transaction, this.mirrorNodeService);

        // If the transaction is still too large,
        // set it to failed with the TRANSACTION_OVERSIZE status code
        // update the transaction, emit the event, and delete the timeout
        if (sdkTransaction === null) {
          await this.transactionRepo.update(
            {
              id: transaction.id,
            },
            {
              status: TransactionStatus.FAILED,
              executedAt: new Date(),
              statusCode: Status.TransactionOversize._code,
            },
          );
          emitTransactionStatusUpdate(this.notificationsPublisher, [{ entityId: transaction.id }]);
          return;
        }

        // TODO then make sure that front end doesn't allow chunks larger than 2k'
        //NOTE: the transactionBytes are set here but are not to be saved. Otherwise,
        // any signatures that were removed in order to make the transaction fit
        // would be lost.
        transaction.transactionBytes = Buffer.from(sdkTransaction.toBytes());

        this.addExecutionTimeout(transaction);
      } catch (error) {
        console.log(error);
      } finally {
        this.schedulerRegistry.deleteTimeout(name);
      }
    };

    const timeout = setTimeout(callback, timeToValidStart - 10 * 1_000);
    this.schedulerRegistry.addTimeout(name, timeout);
  }

  addGroupExecutionTimeout(transactionGroup: TransactionGroup) {
    const name = `group_execution_timeout_${transactionGroup.id}`;

    if (this.schedulerRegistry.doesExist('timeout', name)) return;

    const timeToValidStart =
      transactionGroup.groupItems[0].transaction.validStart.getTime() - Date.now();

    const callback = async () => {
      try {
        await this.executeService.executeTransactionGroup(transactionGroup);
      } catch (error) {
        console.log(error);
      } finally {
        this.schedulerRegistry.deleteTimeout(name);
      }
    };

    const timeout = setTimeout(callback, timeToValidStart + 5 * 1_000);
    this.schedulerRegistry.addTimeout(name, timeout);
  }

  addExecutionTimeout(transaction: Transaction) {
    const name = `execution_timeout_${transaction.id}`;

    if (this.schedulerRegistry.doesExist('timeout', name)) return;

    if (transaction.isManual) return;

    const timeToValidStart = transaction.validStart.getTime() - Date.now();

    const callback = async () => {
      try {
        await this.executeService.executeTransaction(transaction);
      } catch (error) {
        console.log(error);
      } finally {
        this.schedulerRegistry.deleteTimeout(name);
      }
    };

    const timeout = setTimeout(callback, timeToValidStart + 5 * 1_000);
    this.schedulerRegistry.addTimeout(name, timeout);
  }

  getOneWeekLater() {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1_000);
  }

  getOneDayLater() {
    return new Date(Date.now() + 1 * 24 * 60 * 60 * 1_000);
  }

  getOneHourLater() {
    return new Date(Date.now() + 1 * 60 * 60 * 1_000);
  }

  getTenMinutesLater() {
    return new Date(Date.now() + 10 * 60 * 1_000);
  }

  getThreeMinutesLater() {
    return new Date(Date.now() + 3 * 60 * 1_000);
  }

  getThreeMinutesBefore() {
    return new Date(new Date().getTime() - 3 * 60 * 1_000);
  }

  isValidStartExecutable(validStart: Date) {
    const threeMinutesBefore = this.getThreeMinutesBefore().getTime();
    const now = Date.now();
    const time = validStart.getTime();
    return time >= threeMinutesBefore && time <= now;
  }
}
