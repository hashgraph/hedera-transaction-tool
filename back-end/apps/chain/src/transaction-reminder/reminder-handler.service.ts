import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { MurLock } from 'murlock';

import {
  parseTransactionSignKey,
  NatsPublisherService,
  SchedulerService,
  emitTransactionRemindSigners,
} from '@app/common';
import { Notification, NotificationType, Transaction, TransactionStatus } from '@entities';


@Injectable()
export class ReminderHandlerService implements OnModuleInit {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly schedulerService: SchedulerService,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {}

  onModuleInit() {
    this.schedulerService.addListener(this.handleTransactionReminder.bind(this));
  }

  @MurLock(5000, 'key')
  async handleTransactionReminder(key: string) {
    const transactionId = parseTransactionSignKey(key);
    if (!transactionId) {
      return;
    }

    /* Get transaction */
    const transaction = await this.entityManager.findOne(Transaction, {
      where: { id: transactionId },
      relations: { creatorKey: true },
    });

    if (!transaction) {
      return;
    }

    /* Check if transaction is still waiting for signatures */
    if (transaction.status !== TransactionStatus.WAITING_FOR_SIGNATURES) {
      return;
    }

    /* Check if there is already a reminder notification created */
    /* NOTICE: it should be checked if the notification is already sent */
    const notification = await this.entityManager.findOne(Notification, {
      where: {
        entityId: transaction.id,
        type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER,
      },
    });
    if (notification) {
      return;
    }

    emitTransactionRemindSigners(this.notificationsPublisher, [{ entityId: transaction.id }]);
  }
}
