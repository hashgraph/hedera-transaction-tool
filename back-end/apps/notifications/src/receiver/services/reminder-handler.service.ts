import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';
import { MurLock } from 'murlock';

import {
  parseTransactionSignKey,
  keysRequiredToSign,
  MirrorNodeService,
  SchedulerService,
  getRemindSignersDTO,
} from '@app/common';
import { Notification, NotificationType, Transaction, TransactionStatus } from '@entities';

import { ReceiverService } from '../receiver.service';

@Injectable()
export class ReminderHandlerService implements OnModuleInit {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly mirrorNodeService: MirrorNodeService,
    private readonly receiverService: ReceiverService,
    private readonly schedulerService: SchedulerService,
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

    /* Get users required to sign */
    const allKeys = await keysRequiredToSign(
      transaction,
      this.mirrorNodeService,
      this.entityManager,
    );
    const userIds = allKeys
      .map(k => k.userId)
      .concat([transaction.creatorKey.userId])
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter(Boolean);

    await this.receiverService.notifyGeneral(getRemindSignersDTO(transaction, userIds, false));
  }
}
