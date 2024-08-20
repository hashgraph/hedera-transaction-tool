import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In, Not } from 'typeorm';

import {
  keysRequiredToSign,
  MirrorNodeService,
  NotifyForTransactionDto,
  NotifyGeneralDto,
  UpdateIndicatorDto,
} from '@app/common';
import {
  Notification,
  NotificationReceiver,
  NotificationType,
  Transaction,
  TransactionStatus,
} from '@entities';

import { FanOutService } from '../fan-out/fan-out.service';

@Injectable()
export class ReceiverService {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly mirrorNodeService: MirrorNodeService,
    private readonly fanOutService: FanOutService,
  ) {}

  async notifyGeneral(dto: NotifyGeneralDto) {
    const { notification, notificationReceivers } = await this.createNotificationAndReceivers(dto);

    /* Fan out */
    await this.fanOutService.fanOutNew(notification, notificationReceivers);
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
    const indicatorNotification = this.entityManager.create(Notification, {
      type: NotificationType.TRANSACTION_INDICATOR_SIGN,
      content: '',
      entityId: transaction.id,
      actorId: null,
    });

    /* Create receivers */
    const notificationReceivers: NotificationReceiver[] = [];
    const notificationIndicatorReceivers: NotificationReceiver[] = [];

    await this.entityManager.transaction(async manager => {
      await manager.save(Notification, notification);
      await manager.save(Notification, indicatorNotification);

      for (const userId of distinctUserIds) {
        const notificationReceiver = manager.create(NotificationReceiver, {
          notificationId: notification.id,
          userId,
          isRead: false,
          isInAppNotified: null,
          isEmailSent: null,
        });
        const notificationIndicatorReceiver = manager.create(NotificationReceiver, {
          notificationId: indicatorNotification.id,
          userId,
          isRead: false,
          isInAppNotified: null,
          isEmailSent: null,
        });

        await manager.save(NotificationReceiver, notificationReceiver);
        await manager.save(NotificationReceiver, notificationIndicatorReceiver);

        notificationReceivers.push(notificationReceiver);
        notificationIndicatorReceivers.push(notificationIndicatorReceiver);
      }
    });

    /* Fan out */
    await this.fanOutService.fanOutNew(notification, notificationReceivers);
    await this.fanOutService.fanOutNew(indicatorNotification, notificationIndicatorReceivers);
  }

  async updateIndicatorNotification({ transactionId, transactionStatus }: UpdateIndicatorDto) {
    let newIndicatorType: NotificationType | null = null;

    switch (transactionStatus) {
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_SIGN;
        break;
      case TransactionStatus.WAITING_FOR_EXECUTION:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_EXECUTABLE;
        break;
      case TransactionStatus.EXECUTED:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_EXECUTED;
        break;
      case TransactionStatus.EXPIRED:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_EXPIRED;
        break;
    }

    const notificationReceiversToDelete = await this.entityManager.find(NotificationReceiver, {
      where: {
        notification: {
          entityId: transactionId,
          type: Not(In([NotificationType.TRANSACTION_INDICATOR_APPROVE, newIndicatorType])),
        },
      },
      relations: {
        notification: true,
      },
    });

    const distinctUsersToNotify = notificationReceiversToDelete
      .map(nr => nr.userId)
      .filter((v, i, a) => a.indexOf(v) === i);
    const userIdToNotificationReceiversId: {
      [userId: number]: number[];
    } = notificationReceiversToDelete.reduce((acc, nr) => {
      if (!acc[nr.userId]) {
        acc[nr.userId] = [];
      }
      acc[nr.userId].push(nr.id);
      return acc;
    }, {});

    await this.entityManager.delete(NotificationReceiver, {
      id: In(notificationReceiversToDelete.map(nr => nr.id)),
    });

    this.fanOutService.fanOutIndicatorsDelete(userIdToNotificationReceiversId);

    if (newIndicatorType) {
      await this.notifyGeneral({
        type: newIndicatorType,
        content: '',
        entityId: transactionId,
        actorId: null,
        userIds: distinctUsersToNotify,
      });
    }
  }

  private async createNotificationAndReceivers(
    dto: NotifyGeneralDto,
    isInAppNotified = null,
    isEmailSent = null,
  ) {
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
          isInAppNotified,
          isEmailSent,
        });

        await manager.save(NotificationReceiver, notificationReceiver);

        notificationReceivers.push(notificationReceiver);
      }
    });

    return { notification, notificationReceivers };
  }
}
