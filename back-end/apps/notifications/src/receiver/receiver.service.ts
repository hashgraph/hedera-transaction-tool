import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

import {
  getNetwork,
  keysRequiredToSign,
  MirrorNodeService,
  NotifyForTransactionDto,
  NotifyGeneralDto,
  SyncIndicatorsDto,
} from '@app/common';
import {
  Notification,
  NotificationAdditionalData,
  NotificationReceiver,
  NotificationType,
  Transaction,
  TransactionApprover,
  TransactionStatus,
} from '@entities';

import { FanOutService } from '../fan-out/fan-out.service';
import { MurLock } from 'murlock';

@Injectable()
export class ReceiverService {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly mirrorNodeService: MirrorNodeService,
    private readonly fanOutService: FanOutService,
  ) {}

  @MurLock(5000, 'dto.entityId')
  async notifyGeneral(dto: NotifyGeneralDto) {
    if (!dto.userIds || dto.userIds.length === 0) return;

    const { notification, notificationReceivers } = await this.entityManager.transaction(
      async transactionalEntityManager => {
        /* Get notification if exists */
        let notification = await transactionalEntityManager.findOne(Notification, {
          where: {
            entityId: dto.entityId,
            type: dto.type,
            content: dto.content,
            actorId: dto.actorId,
          },
          relations: {
            notificationReceivers: true,
          },
        });

        /* Create notification */
        if (!notification) {
          notification = await this.createNotification(
            transactionalEntityManager,
            dto.type,
            dto.content,
            dto.entityId,
            dto.actorId,
            dto.additionalData,
          );
        }

        /* Create receivers */
        if (!dto.recreateReceivers) {
          dto.userIds = dto.userIds.filter(
            userId => !notification.notificationReceivers.some(nr => nr.userId === userId),
          );
        }

        const notificationReceivers = await this.createReceivers(
          transactionalEntityManager,
          notification.id,
          dto.userIds,
        );

        return { notification, notificationReceivers };
      },
    );

    /* Fan out */
    if (notification && notificationReceivers.length > 0) {
      await this.fanOutService.fanOutNew(notification, notificationReceivers);
    }
  }

  @MurLock(5000, 'transactionId')
  async notifyTransactionRequiredSigners({
    transactionId,
    additionalData,
  }: NotifyForTransactionDto) {
    /* Get transaction */
    const transaction = await this.entityManager.findOne(Transaction, {
      where: {
        id: transactionId,
      },
      relations: {
        creatorKey: true,
      },
    });

    if (!transaction) throw new Error('Transaction not found');
    const networkString = getNetwork(transaction);

    /* Get users required to sign */
    const userIds = await this.getUsersIdsRequiredToSign(this.entityManager, transaction);

    /* Notify */
    await this.notifyGeneral({
      type: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
      content: `A new transaction requires your review and signature. Please visit the Hedera Transaction Tool and locate the transaction.\nTransaction ID: ${transaction.transactionId}\nNetwork: ${networkString}`,
      entityId: transaction.id,
      actorId: null,
      userIds: userIds.filter(id => id !== transaction.creatorKey?.userId),
      additionalData,
    });

    /* Sync indicators */
    await this.syncIndicators({
      transactionId,
      transactionStatus: transaction.status,
      additionalData,
    });
  }

  @MurLock(5000, 'transactionId')
  async syncIndicators({ transactionId, transactionStatus, additionalData }: SyncIndicatorsDto) {
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
      case TransactionStatus.ARCHIVED:
        newIndicatorType = NotificationType.TRANSACTION_INDICATOR_ARCHIVED;
        break;
    }

    const notificationReceiversToDelete = await this.entityManager.transaction(
      async transactionalEntityManager => {
        /* Get notification indicator entities to delete */
        const indicatorNotifications = await this.getIndicatorNotifications(
          transactionalEntityManager,
          transactionId,
        );
        const notificationsToDelete = indicatorNotifications.filter(
          n => n.type !== newIndicatorType,
        );

        /* Delete old indicator notifications */
        const notificationReceiversToDelete = notificationsToDelete.flatMap(
          n => n.notificationReceivers,
        );

        if (notificationReceiversToDelete.length > 0) {
          await transactionalEntityManager.delete(NotificationReceiver, {
            id: In(notificationReceiversToDelete.map(nr => nr.id)),
          });
        }
        if (notificationsToDelete.length > 0) {
          await transactionalEntityManager.delete(Notification, {
            id: In(notificationsToDelete.map(n => n.id)),
          });
        }

        return notificationReceiversToDelete;
      },
    );

    /* Fan out deletion message */
    if (notificationReceiversToDelete.length > 0) {
      this.fanOutIndicatorsDelete(notificationReceiversToDelete);
    }

    /* Notify if new indicator */
    if (!newIndicatorType) return;

    /* Get transaction participants */
    const { approversShouldChooseUserIds, requiredUserIds } = await this.getTransactionParticipants(
      this.entityManager,
      transactionId,
    );

    const indicatorNotifications = await this.getIndicatorNotifications(
      this.entityManager,
      transactionId,
    );

    if (newIndicatorType === NotificationType.TRANSACTION_INDICATOR_SIGN) {
      const indicatorNotification = indicatorNotifications.find(
        n => n.type === NotificationType.TRANSACTION_INDICATOR_SIGN,
      );
      await this.syncActionIndicators(
        this.entityManager,
        NotificationType.TRANSACTION_INDICATOR_SIGN,
        indicatorNotification,
        transactionId,
        requiredUserIds,
        additionalData,
      );
    } else {
      // await this.notifyGeneral({
      //   type: newIndicatorType,
      //   content: '',
      //   entityId: transactionId,
      //   actorId: null,
      //   userIds: participants,
      // });
    }

    /* Sync approve indicators */
    const indicatorApproveNotification = indicatorNotifications.find(
      n => n.type === NotificationType.TRANSACTION_INDICATOR_APPROVE,
    );

    await this.syncActionIndicators(
      this.entityManager,
      NotificationType.TRANSACTION_INDICATOR_APPROVE,
      indicatorApproveNotification,
      transactionId,
      approversShouldChooseUserIds,
      additionalData,
    );
  }

  private async syncActionIndicators(
    entityManager: EntityManager,
    type: NotificationType,
    notification: Notification,
    transactionId: number,
    userIds: number[],
    additionalData?: NotificationAdditionalData,
  ) {
    /* Create new if not exists */
    if (!notification) {
      notification = await this.createNotification(
        entityManager,
        type,
        '',
        transactionId,
        null,
        additionalData,
      );
    }

    /* Remove indicator notification for users that should not take action */
    try {
      const notificationReceiversToDelete = notification.notificationReceivers.filter(
        nr => !userIds.includes(nr.userId),
      );

      if (notificationReceiversToDelete.length > 0) {
        await entityManager.delete(NotificationReceiver, {
          id: In(notificationReceiversToDelete.map(nr => nr.id)),
        });
      }

      /* Fan out deletion message */
      this.fanOutIndicatorsDelete(notificationReceiversToDelete);
    } catch (error) {
      console.log(error);
    }

    /* Create new indicator notification for users that should take action and haven't received indicator */
    const userIdsToCreate = userIds.filter(
      id => !notification.notificationReceivers.some(nr => nr.userId === id),
    );

    const notificationReceivers = await this.createReceivers(
      entityManager,
      notification.id,
      userIdsToCreate,
    );

    if (notificationReceivers.length > 0) {
      await this.fanOutService.fanOutNew(notification, notificationReceivers);
    }
  }

  /* Fan out deletion message */
  private fanOutIndicatorsDelete(notificationReceivers: NotificationReceiver[]) {
    if (!Array.isArray(notificationReceivers) || notificationReceivers.length === 0) return;

    const userIdToNotificationReceiversId: {
      [userId: number]: number[];
    } = notificationReceivers.reduce((acc, nr) => {
      if (!acc[nr.userId]) {
        acc[nr.userId] = [];
      }
      acc[nr.userId].push(nr.id);
      return acc;
    }, {});
    this.fanOutService.fanOutIndicatorsDelete(userIdToNotificationReceiversId);
  }

  /* Create notification */
  private async createNotification(
    entityManager: EntityManager,
    type: NotificationType,
    content: string,
    entityId: number,
    actorId: number,
    additionalData?: NotificationAdditionalData,
  ) {
    /* Create notification */
    const notification = entityManager.create(Notification, {
      type: type,
      content: content,
      entityId: entityId,
      actorId: actorId,
      notificationReceivers: [],
      additionalData: additionalData,
    });
    await entityManager.save(Notification, notification);
    return notification;
  }

  /* Create notification receivers */
  private async createReceivers(
    entityManager: EntityManager,
    notificationId: number,
    userIds: number[],
    isInAppNotified: boolean | null = null,
    isEmailSent: boolean | null = null,
  ) {
    const notificationReceivers: NotificationReceiver[] = [];
    for (const id of userIds) {
      try {
        const notificationReceiver = entityManager.create(NotificationReceiver, {
          notificationId,
          userId: id,
          isRead: false,
          isInAppNotified,
          isEmailSent,
        });

        await entityManager.save(NotificationReceiver, notificationReceiver);

        notificationReceivers.push(notificationReceiver);
      } catch (error) {
        console.log(error);
      }
    }

    return notificationReceivers;
  }

  /* Get all indicator notifications for a transaction */
  private async getIndicatorNotifications(entityManager: EntityManager, transactionId: number) {
    const indicatorTypes = Object.values(NotificationType).filter(t => t.includes('INDICATOR'));

    return entityManager.find(Notification, {
      where: {
        entityId: transactionId,
        type: In(indicatorTypes),
      },
      relations: {
        notificationReceivers: true,
      },
    });
  }

  /* Get all participants of a transaction */
  private async getTransactionParticipants(entityManager: EntityManager, transactionId: number) {
    const transaction = await entityManager.findOne(Transaction, {
      where: { id: transactionId },
      // relations: {
      //   creatorKey: true,
      //   observers: true,
      //   signers: true,
      // },
    });
    const approvers = await this.getApproversByTransactionId(entityManager, transactionId);

    // const creatorId = transaction.creatorKey.userId;
    // const signerUserIds = transaction.signers.map(s => s.userId);
    // const observerUserIds = transaction.observers.map(o => o.userId);
    const requiredUserIds = await this.getUsersIdsRequiredToSign(entityManager, transaction);
    const approversUserIds = approvers.map(a => a.userId);
    const approversGaveChoiceUserIds = approvers
      .filter(a => a.approved !== null)
      .map(a => a.userId)
      .filter(Boolean);
    const approversShouldChooseUserIds = [
      TransactionStatus.WAITING_FOR_EXECUTION,
      TransactionStatus.WAITING_FOR_SIGNATURES,
    ].includes(transaction.status)
      ? approvers
          .filter(a => a.approved === null)
          .map(a => a.userId)
          .filter(Boolean)
      : [];

    const participants = [
      // creatorId,
      // ...signerUserIds,
      // ...observerUserIds,
      ...approversUserIds,
      ...requiredUserIds,
    ]
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i);

    return {
      // creatorId,
      // signerUserIds,
      // observerUserIds,
      approversUserIds,
      requiredUserIds,
      approversGaveChoiceUserIds,
      approversShouldChooseUserIds,
      participants,
    };
  }

  /* Get all user ids required to sign a transaction */
  private async getUsersIdsRequiredToSign(entityManager: EntityManager, transaction: Transaction) {
    /* Get all keys required to sign */
    const allKeys = await keysRequiredToSign(transaction, this.mirrorNodeService, entityManager);

    const distinctUserIds = allKeys
      .map(k => k.userId)
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter(Boolean);

    return distinctUserIds;
  }

  /* Get the full list of approvers by transactionId. This will return an array of approvers that may be trees */
  private async getApproversByTransactionId(
    entityManager: EntityManager,
    transactionId: number,
  ): Promise<TransactionApprover[]> {
    if (typeof transactionId !== 'number') return [];

    return entityManager.query(
      `
      with recursive approverList as
        (
          select * from transaction_approver 
          where "transactionId" = $1
            union all
              select approver.* from transaction_approver as approver
              join approverList on approverList."id" = approver."listId"
        )
      select * from approverList
      where approverList."deletedAt" is null
      `,
      [transactionId],
    );
  }
}
