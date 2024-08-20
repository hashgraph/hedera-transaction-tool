import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager } from 'typeorm';

import {
  keysRequiredToSign,
  MirrorNodeService,
  NotifyForTransactionDto,
  NotifyGeneralDto,
} from '@app/common';
import { Notification, NotificationReceiver, NotificationType, Transaction } from '@entities';

import { FanOutService } from '../fan-out/fan-out.service';

@Injectable()
export class ReceiverService {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly mirrorNodeService: MirrorNodeService,
    private readonly fanOutService: FanOutService,
  ) {}

  async notifyGeneral(dto: NotifyGeneralDto) {
    /* Create notification */
    const notification = this.entityManager.create(Notification, {
      type: dto.type,
      content: dto.content,
      entityId: dto.entityId,
      actorId: dto.actorId,
    });

    /* Create receivers */
    const notificationReceivers: NotificationReceiver[] = [];

    await this.entityManager.transaction(async manager => {
      await manager.save(Notification, notification);

      for (const id of dto.userIds) {
        const notificationReceiver = manager.create(NotificationReceiver, {
          notificationId: notification.id,
          userId: id,
          isRead: false,
          isInAppNotified: null,
          isEmailSent: null,
        });

        await manager.save(NotificationReceiver, notificationReceiver);

        notificationReceivers.push(notificationReceiver);
      }
    });

    /* Fan out */
    await this.fanOutService.fanOut(notification, notificationReceivers);
  }

  async notifyTransactionRequiredSigners(dto: NotifyForTransactionDto) {
    /* Get transaction */
    const transaction = await this.entityManager.findOne(Transaction, {
      where: {
        id: dto.transactionId,
      },
      relations: {
        creatorKey: {
          user: true,
        },
      },
    });

    if (!transaction) throw new Error('Transaction not found');

    const allKeys = await keysRequiredToSign(
      transaction,
      this.mirrorNodeService,
      this.entityManager,
    );

    const distinctUserIds = allKeys
      .map(k => k.userId)
      .filter((v, i, a) => a.indexOf(v) === i)
      // .filter(id => id !== transaction.creatorKey?.user?.id)
      .filter(Boolean);

    /* Create notification */
    const notification = this.entityManager.create(Notification, {
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      content: `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction using the following ID: ${transaction.transactionId}.`,
      entityId: transaction.id,
      actorId: null,
    });

    /* Create receivers */
    const notificationReceivers: NotificationReceiver[] = [];

    await this.entityManager.transaction(async manager => {
      await manager.save(Notification, notification);

      for (const userId of distinctUserIds) {
        const notificationReceiver = manager.create(NotificationReceiver, {
          notificationId: notification.id,
          userId,
          isRead: false,
          isInAppNotified: null,
          isEmailSent: null,
        });

        await manager.save(NotificationReceiver, notificationReceiver);

        notificationReceivers.push(notificationReceiver);
      }
    });

    /* Fan out */
    await this.fanOutService.fanOut(notification, notificationReceivers);
  }

  async notifyTransactionCreatorOnReadyForExecution(dto: NotifyForTransactionDto) {
    /* Get transaction */
    const transaction = await this.entityManager.findOne(Transaction, {
      where: {
        id: dto.transactionId,
      },
      relations: {
        creatorKey: {
          user: true,
        },
      },
    });

    if (!transaction) throw new Error('Transaction not found');

    /* Create notification */
    const notification = this.entityManager.create(Notification, {
      type: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
      content: `Transaction ${transaction.transactionId} is ready for execution`,
      entityId: transaction.id,
      actorId: null,
    });

    /* Create receiver */
    const notificationReceiver = this.entityManager.create(NotificationReceiver, {
      userId: transaction.creatorKey.userId,
      isRead: false,
      isInAppNotified: null,
      isEmailSent: null,
    });

    await this.entityManager.transaction(async manager => {
      await manager.save(Notification, notification);
      notificationReceiver.notificationId = notification.id;
      await manager.save(NotificationReceiver, notificationReceiver);
    });

    /* Fan out */
    await this.fanOutService.fanOut(notification, [notificationReceiver]);
  }
}
