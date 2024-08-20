import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

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

  async notifyGeneral({ type, content, entityId, actorId, userIds }: NotifyGeneralDto) {
    /* Get notification if exists */
    let notification = await this.entityManager.findOne(Notification, {
      where: {
        entityId,
        type,
        content,
        actorId,
      },
      relations: {
        notificationReceivers: true,
      },
    });

    /* Create notification */
    if (!notification) {
      notification = await this.createNotification(type, content, entityId, actorId);
    }

    /* Create receivers */
    userIds = userIds.filter(
      userId => !notification.notificationReceivers.some(nr => nr.userId === userId),
    );
    const notificationReceivers = await this.createReceivers(notification.id, userIds);

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

    /* Get users required to sign */
    const userIds = await this.getUsersIdsRequiredToSign(transaction);

    /* Notify */
    await this.notifyGeneral({
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      content: `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction using the following ID: ${transaction.transactionId}.`,
      entityId: transaction.id,
      actorId: null,
      userIds: userIds.filter(id => id !== transaction.creatorKey?.userId),
    });

    /* Sync indicators */
    await this.syncSignIndicators(transaction, userIds);
  }

  async updateNewStatusIndicatorNotification({
    transactionId,
    transactionStatus,
  }: UpdateIndicatorDto) {
    let newIndicatorType: NotificationType | null = null;

    /* Determine new indicator type */
    switch (transactionStatus) {
      case TransactionStatus.WAITING_FOR_SIGNATURES:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_SIGN;
        break;
      case TransactionStatus.WAITING_FOR_EXECUTION:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_EXECUTABLE;
        break;
      case TransactionStatus.EXECUTED:
      case TransactionStatus.FAILED:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_EXECUTED;
        break;
      case TransactionStatus.EXPIRED:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_EXPIRED;
        break;
    }

    /* Get notification indicator entities to delete */
    const indicatorTypes = Object.values(NotificationType).filter(t => t.includes('INDICATOR'));
    const inTypes = indicatorTypes.filter(t => t !== newIndicatorType);
    const notificationToDelete = await this.entityManager.find(Notification, {
      where: {
        entityId: transactionId,
        type: In(inTypes),
      },
      relations: {
        notificationReceivers: true,
      },
    });

    /* Delete old indicator notifications */
    const notificationReceiversToDelete = notificationToDelete.flatMap(
      n => n.notificationReceivers,
    );

    await this.entityManager.delete(NotificationReceiver, {
      id: In(notificationReceiversToDelete.map(nr => nr.id)),
    });
    await this.entityManager.delete(Notification, {
      id: In(notificationToDelete.map(n => n.id)),
    });

    /* Fan out deletion message */
    const userIdToNotificationReceiversId: {
      [userId: number]: number[];
    } = notificationReceiversToDelete.reduce((acc, nr) => {
      if (!acc[nr.userId]) {
        acc[nr.userId] = [];
      }
      acc[nr.userId].push(nr.id);
      return acc;
    }, {});
    this.fanOutService.fanOutIndicatorsDelete(userIdToNotificationReceiversId);

    /* Notify if new indicator */
    const usersIdsToNotify = notificationReceiversToDelete
      .map(nr => nr.userId)
      .filter((v, i, a) => a.indexOf(v) === i);

    if (newIndicatorType) {
      await this.notifyGeneral({
        type: newIndicatorType,
        content: '',
        entityId: transactionId,
        actorId: null,
        userIds: usersIdsToNotify,
      });
    }

    /* Sync sign indicators */
    await this.syncSignIndicators(transactionId, null);
  }

  async syncSignIndicators(transaction: number | Transaction, userIdsRequired: number[] | null) {
    if (typeof transaction === 'number') {
      /* Get transaction */
      transaction = await this.entityManager.findOne(Transaction, {
        where: {
          id: transaction,
        },
        relations: {
          creatorKey: {
            user: true,
          },
        },
      });

      if (!transaction) throw new Error('Transaction not found');
    }

    /* Get users required to sign */
    if (!Array.isArray(userIdsRequired)) {
      userIdsRequired = await this.getUsersIdsRequiredToSign(transaction);
    }

    /* Get the indicator notification */
    let notification = await this.entityManager.findOne(Notification, {
      where: {
        entityId: transaction.id,
        type: NotificationType.TRANSACTION_INDICATOR_SIGN,
      },
      relations: {
        notificationReceivers: true,
      },
    });

    /* Create new if not exists */
    if (!notification) {
      notification = await this.createNotification(
        NotificationType.TRANSACTION_INDICATOR_SIGN,
        '',
        transaction.id,
        null,
      );
    }

    /* Remove indicator notification for users that should not sign */
    try {
      const notificationReceiversToDelete = notification.notificationReceivers.filter(
        nr => !userIdsRequired.includes(nr.userId),
      );
      if (notificationReceiversToDelete.length > 0) {
        await this.entityManager.delete(NotificationReceiver, {
          id: In(notificationReceiversToDelete.map(nr => nr.id)),
        });
      }

      /* Fan out deletion message */
      const userIdToNotificationReceiversId: {
        [userId: number]: number[];
      } = notificationReceiversToDelete.reduce((acc, nr) => {
        if (!acc[nr.userId]) {
          acc[nr.userId] = [];
        }
        acc[nr.userId].push(nr.id);
        return acc;
      }, {});
      this.fanOutService.fanOutIndicatorsDelete(userIdToNotificationReceiversId);
    } catch (error) {
      console.error(error);
    }

    /* Create new indicator notification for users that should sign and haven't received */
    const notificationReceiversToCreate = userIdsRequired.filter(
      id => !notification.notificationReceivers.some(nr => nr.userId === id),
    );
    const notificationReceivers = await this.createReceivers(
      notification.id,
      notificationReceiversToCreate,
    );

    if (notificationReceivers.length > 0) {
      await this.fanOutService.fanOutNew(notification, notificationReceivers);
    }
  }

  private async createNotification(
    type: NotificationType,
    content: string,
    entityId: number,
    actorId: number,
  ) {
    /* Create notification */
    const notification = this.entityManager.create(Notification, {
      type: type,
      content: content,
      entityId: entityId,
      actorId: actorId,
      notificationReceivers: [],
    });
    await this.entityManager.save(Notification, notification);

    return notification;
  }

  private async createReceivers(
    notificationId: number,
    userIds: number[],
    isInAppNotified: boolean | null = null,
    isEmailSent: boolean | null = null,
  ) {
    const notificationReceivers: NotificationReceiver[] = [];
    for (const id of userIds) {
      try {
        const notificationReceiver = this.entityManager.create(NotificationReceiver, {
          notificationId,
          userId: id,
          isRead: false,
          isInAppNotified,
          isEmailSent,
        });

        await this.entityManager.save(NotificationReceiver, notificationReceiver);

        notificationReceivers.push(notificationReceiver);
      } catch (error) {
        console.error(error);
      }
    }

    return notificationReceivers;
  }

  private async getUsersIdsRequiredToSign(transaction: Transaction) {
    /* Get all keys required to sign */
    const allKeys = await keysRequiredToSign(
      transaction,
      this.mirrorNodeService,
      this.entityManager,
    );

    const distinctUserIds = allKeys
      .map(k => k.userId)
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter(Boolean);

    return distinctUserIds;
  }
}
