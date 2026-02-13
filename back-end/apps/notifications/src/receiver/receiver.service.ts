import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

import {
  filterActiveUserKeys,
  keysRequiredToSign,
  TransactionSignatureService,
  NatsPublisherService,
  NotificationEventDto,
} from '@app/common';
import {
  Notification,
  NOTIFICATION_CHANNELS,
  NotificationReceiver,
  NotificationType,
  Transaction,
  TransactionApprover,
  TransactionStatus,
  User,
  UserKey,
} from '@entities';

import { EmailNotificationDto } from '../dtos';
import {
  emitDeleteNotifications,
  emitEmailNotifications,
  emitNewNotifications,
  emitNotifyClients,
} from './emit-notifications';

@Injectable()
export class ReceiverService {
  // Mapping from transaction status to the in-app indicator notification type
  private static readonly IN_APP_NOTIFICATION_TYPES: Partial<Record<TransactionStatus, NotificationType>> = {
    [TransactionStatus.WAITING_FOR_SIGNATURES]: NotificationType.TRANSACTION_INDICATOR_SIGN,
    [TransactionStatus.WAITING_FOR_EXECUTION]: NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
    [TransactionStatus.EXECUTED]: NotificationType.TRANSACTION_INDICATOR_EXECUTED,
    [TransactionStatus.FAILED]: NotificationType.TRANSACTION_INDICATOR_FAILED,
    [TransactionStatus.EXPIRED]: NotificationType.TRANSACTION_INDICATOR_EXPIRED,
    [TransactionStatus.CANCELED]: NotificationType.TRANSACTION_INDICATOR_CANCELLED,
    [TransactionStatus.ARCHIVED]: NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
  };

  // Mapping from transaction status to the email notification type
  private static readonly EMAIL_NOTIFICATION_TYPES: Partial<Record<TransactionStatus, NotificationType>> = {
    [TransactionStatus.WAITING_FOR_SIGNATURES]: NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
    [TransactionStatus.WAITING_FOR_EXECUTION]: NotificationType.TRANSACTION_READY_FOR_EXECUTION,
    [TransactionStatus.EXECUTED]: NotificationType.TRANSACTION_EXECUTED,
    // [TransactionStatus.FAILED]: NotificationType.TRANSACTION_EXECUTED,
    // [TransactionStatus.REJECTED]: NotificationType.TRANSACTION_EXECUTED,
    [TransactionStatus.EXPIRED]: NotificationType.TRANSACTION_EXPIRED,
    [TransactionStatus.CANCELED]: NotificationType.TRANSACTION_CANCELLED,
  };

  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly transactionSignatureService: TransactionSignatureService,
    private readonly notificationsPublisher: NatsPublisherService,
  ) {}

  // --- Small lookups -----------------------------------------------------

  private getInAppNotificationType(status: TransactionStatus): NotificationType | null {
    return ReceiverService.IN_APP_NOTIFICATION_TYPES[status] ?? null;
  }

  private getEmailNotificationType(status: TransactionStatus): NotificationType | null {
    return ReceiverService.EMAIL_NOTIFICATION_TYPES[status] ?? null;
  }

  // --- Transaction fetch / approver helpers ------------------------------

  private async fetchTransactionsWithRelations(
    transactionIds: number[],
    withDeleted = false,
  ): Promise<Map<number, Transaction>> {
    const transactions = await this.entityManager.find(Transaction, {
      where: { id: In(transactionIds) },
      relations: {
        creatorKey: true,
        observers: true,
        signers: true,
        groupItem: true,
      },
      withDeleted,
    });

    return new Map(transactions.map(t => [t.id, t]));
  }

  private async getApproversByTransactionIds(
    entityManager: EntityManager,
    transactionIds: number[],
  ): Promise<Map<number, TransactionApprover[]>> {
    if (transactionIds.length === 0) return new Map();

    // Run the recursive CTE once for all transactions
    const allApprovers = await entityManager.query(
      `
          WITH RECURSIVE approverList AS (
              SELECT * FROM transaction_approver
              WHERE "transactionId" = ANY($1)
              UNION ALL
              SELECT approver.* FROM transaction_approver AS approver
                                         JOIN approverList ON approverList."id" = approver."listId"
          )
          SELECT * FROM approverList
          WHERE approverList."deletedAt" IS NULL
      `,
      [transactionIds],
    );

    // Group by transactionId
    const approversMap = new Map<number, TransactionApprover[]>();

    for (const approver of allApprovers) {
      const txId = approver.transactionId;
      if (!approversMap.has(txId)) {
        approversMap.set(txId, []);
      }
      approversMap.get(txId)!.push(approver);
    }

    return approversMap;
  }

  // --- Participant / recipient resolution -------------------------------

  private async getTransactionParticipants(
    entityManager: EntityManager,
    transaction: Transaction,
    approvers: TransactionApprover[],
    keyCache: Map<string, UserKey>,
  ) {
    const creatorId = transaction.creatorKey.userId;
    const signerUserIds = transaction.signers.map(s => s.userId);
    const observerUserIds = transaction.observers.map(o => o.userId);
    const requiredUserIds = await this.getUsersIdsRequiredToSign(entityManager, transaction, keyCache);

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
      ...new Set([
        creatorId,
        ...signerUserIds,
        ...observerUserIds,
        ...approversUserIds,
        ...requiredUserIds,
      ].filter(Boolean)),
    ];

    return {
      creatorId,
      signerUserIds,
      observerUserIds,
      approversUserIds,
      requiredUserIds,
      approversGaveChoiceUserIds,
      approversShouldChooseUserIds,
      participants,
    };
  }

  private async getUsersIdsRequiredToSign(
    entityManager: EntityManager,
    transaction: Transaction,
    keyCache?: Map<string, UserKey>,
  ) {
    const allKeys = await keysRequiredToSign(
      transaction,
      this.transactionSignatureService,
      entityManager,
      false,
      null,
      keyCache,
    );

    // Filter out keys/users that have been soft-deleted to prevent notification failures
    const activeKeys = filterActiveUserKeys(allKeys);

    return [...new Set(activeKeys.map((k) => k.userId).filter(Boolean))];
  }

  private async getNotificationReceiverIds(
    entityManager: EntityManager,
    transaction: Transaction,
    newIndicatorType: NotificationType,
    approvers: TransactionApprover[],
    keyCache?: Map<string, UserKey>,
  ): Promise<number[]> {
    /* Get transaction participants */
    const {
      approversUserIds,
      approversShouldChooseUserIds,
      observerUserIds,
      requiredUserIds,
      creatorId,
    } = await this.getTransactionParticipants(entityManager, transaction, approvers, keyCache);

    switch (newIndicatorType) {
      case NotificationType.TRANSACTION_APPROVAL_REJECTION:
      case NotificationType.TRANSACTION_INDICATOR_REJECTED:
        return [creatorId, ...approversUserIds, ...observerUserIds];

      case NotificationType.TRANSACTION_APPROVED:
      case NotificationType.TRANSACTION_INDICATOR_APPROVE:
        return approversShouldChooseUserIds;

      case NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES:
      case NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER:
      case NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER_MANUAL:
      case NotificationType.TRANSACTION_INDICATOR_SIGN:
        return requiredUserIds;

      case NotificationType.TRANSACTION_READY_FOR_EXECUTION:
      case NotificationType.TRANSACTION_INDICATOR_EXECUTABLE:
      case NotificationType.TRANSACTION_EXECUTED:
      case NotificationType.TRANSACTION_INDICATOR_EXECUTED:
      case NotificationType.TRANSACTION_INDICATOR_FAILED:
      case NotificationType.TRANSACTION_EXPIRED:
      case NotificationType.TRANSACTION_INDICATOR_EXPIRED:
      case NotificationType.TRANSACTION_INDICATOR_ARCHIVED:
        return [creatorId, ...approversUserIds, ...observerUserIds, ...requiredUserIds];

      case NotificationType.TRANSACTION_CANCELLED:
      case NotificationType.TRANSACTION_INDICATOR_CANCELLED:
        return [...approversUserIds, ...observerUserIds, ...requiredUserIds];

      default:
        console.warn(`No recipient logic for ${newIndicatorType}`);
        return [];
    }
  }

  // --- Preferences & receiver creation helpers --------------------------

  private async loadUsersWithPreferences(
    entityManager: EntityManager,
    userIds: number[],
    cache: Map<number, User>,
  ): Promise<void> {
    const uncachedIds = userIds.filter((id) => !cache.has(id));

    if (uncachedIds.length === 0) return;

    const users = await entityManager.find(User, {
      where: { id: In(uncachedIds) },
      relations: { notificationPreferences: true },
    });

    users.forEach((user) => cache.set(user.id, user));
  }

  private async filterReceiversByPreferenceForType(
    entityManager: EntityManager,
    notificationType: NotificationType,
    userIds: Set<number>,
    cache: Map<number, User>, // User with preferences relation
  ): Promise<number[]> {
    // Load uncached users
    await this.loadUsersWithPreferences(entityManager, Array.from(userIds), cache);

    // Filter based on preferences
    const result: number[] = [];
    for (const id of userIds) {
      const user = cache.get(id);
      if (!user) continue; // Safety check

      const preference = user.notificationPreferences?.find(
        p => p.type === notificationType
      );

      if (preference ? preference.inApp : true) {
        result.push(id);
      }
    }

    return result;
  }

  private async createNotificationReceivers(
    entityManager: EntityManager,
    notification: Notification,
    newReceiverIds: number[],
  ) {
    if (newReceiverIds.length === 0) return [];

    const type = NOTIFICATION_CHANNELS[notification.type];

    return entityManager.save(
      NotificationReceiver,
      newReceiverIds.map(userId => ({
        notificationId: notification.id,
        userId,
        isRead: false,
        isInAppNotified: type.inApp ? false : null,
        isEmailSent: type.email ? false : null,
        notification,
      })),
    );
  }

  private async createNotificationWithReceivers(
    entityManager: EntityManager,
    transaction: Transaction,
    approvers: TransactionApprover[],
    notificationType: NotificationType,
    additionalData: any,
    cache: Map<number, User>,
    keyCache: Map<string, UserKey>,
  ): Promise<NotificationReceiver[]> {
    // Get all potential receiver IDs
    const allReceiverUserIds = await this.getNotificationReceiverIds(
      entityManager,
      transaction,
      notificationType,
      approvers,
      keyCache,
    );

    // Filter by preferences BEFORE creating notification
    const receiverUserIds = await this.filterReceiversByPreferenceForType(
      entityManager,
      notificationType,
      new Set(allReceiverUserIds),
      cache,
    );

    // Create new notification
    const notification = await entityManager.save(Notification, {
      type: notificationType,
      entityId: transaction.id,
      notificationReceivers: [],
      additionalData: additionalData,
    });

    return await this.createNotificationReceivers(
      entityManager,
      notification,
      receiverUserIds,
    );
  }

  // --- Indicator deletion helpers --------------------------------------

  /* Get all indicator notifications for a transaction */
  private async getIndicatorNotifications(entityManager: EntityManager, transactionId: number) {
    const indicatorTypes = Object.values(NotificationType).filter(t => t.includes('INDICATOR'));

    return entityManager.find(Notification, {
      where: {
        entityId: transactionId,
        type: In(indicatorTypes),
      },
      relations: { notificationReceivers: true },
    });
  }

  /**
   * Deletes existing indicator notifications and their receivers for a transaction
   * Returns list of deleted receiver ids for websocket delete message.
   */
  private async deleteExistingIndicators(
    entityManager: EntityManager,
    transaction: Transaction,
  ): Promise<Array<{ userId: number; receiverId: number }>> {
    const indicatorNotifications = await this.getIndicatorNotifications(
      entityManager,
      transaction.id,
    );

    if (indicatorNotifications.length === 0) {
      return [];
    }

    const notificationReceiversToDelete = indicatorNotifications.flatMap(
      n => n.notificationReceivers,
    );

    const deletedReceiverIds = notificationReceiversToDelete.map(nr => ({
      userId: nr.userId,
      receiverId: nr.id,
    }));

    // Delete receivers first, then notifications (FK constraint order)
    if (notificationReceiversToDelete.length > 0) {
      await entityManager.delete(NotificationReceiver, {
        id: In(notificationReceiversToDelete.map(nr => nr.id)),
      });
    }

    if (indicatorNotifications.length > 0) {
      await entityManager.delete(Notification, {
        id: In(indicatorNotifications.map(n => n.id)),
      });
    }

    return deletedReceiverIds;
  }

  // --- Processing a specific notification type --------------------------

  /**
   * Consolidated logic for processing a notification type.
   * Returns newly created receivers and updated receivers ready for collection.
   */
  private async processNotificationType(
    entityManager: EntityManager,
    transactionId: number,
    notificationType: NotificationType,
    userIds: Set<number>,
    cache: Map<number, User>,
  ): Promise<{
    newReceivers: NotificationReceiver[];
    updatedReceivers: NotificationReceiver[];
  }> {
    // Get notification
    const notification = await entityManager.findOne(Notification, {
      where: {
        entityId: transactionId,
        type: notificationType,
      },
      relations: { notificationReceivers: true },
    });

    // Get users who should receive this notification (filtered by preferences)
    const receiverIds = await this.filterReceiversByPreferenceForType(
      entityManager,
      notificationType,
      userIds,
      cache,
    );

    // Update existing receivers
    let updatedReceivers: NotificationReceiver[] = [];

    const receiversToUpdate = notification.notificationReceivers.filter(
      nr => receiverIds.includes(nr.userId)
    );

    if (receiversToUpdate.length > 0) {
      const updateFields = NOTIFICATION_CHANNELS[notificationType].email
        ? { isEmailSent: false }
        : { isRead: false, isInAppNotified: false };

      const idsToUpdate = receiversToUpdate.map(nr => nr.id);
      await entityManager.update(
        NotificationReceiver,
        { id: In(idsToUpdate) },
        updateFields,
      );

      // Reload updated receivers with notification relation
      // The notification relation is needed for sending
      updatedReceivers = await entityManager.find(NotificationReceiver, {
        where: { id: In(idsToUpdate) },
        relations: { notification: true },
      });
    }

    const existingUserIds = new Set(
      notification.notificationReceivers.map(nr => nr.userId)
    );

    // Separate new receivers from existing ones
    const newReceiverIds = receiverIds.filter(id => !existingUserIds.has(id));

    const newReceivers = await this.createNotificationReceivers(
      entityManager,
      notification,
      newReceiverIds,
    );

    return { newReceivers, updatedReceivers };
  }

  /**
   * Process reminder email notification - creates a new reminder notification
   * instead of updating existing ones.
   */
  private async processReminderEmail(
    entityManager: EntityManager,
    transaction: Transaction,
    userIds: Set<number>,
    cache: Map<number, User>,
  ): Promise<NotificationReceiver[]> {
    // Always use TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER type
    const notificationType = NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES_REMINDER;

    // Create a NEW notification (not get existing)
    const notification = await entityManager.save(Notification, {
      entityId: transaction.id,
      type: notificationType,
      additionalData: {
        validStart: transaction.validStart,
        transactionId: transaction.transactionId,
        network: transaction.mirrorNetwork,
      }
    });

    // Get users who should receive this notification (filtered by preferences)
    const receiverIds = await this.filterReceiversByPreferenceForType(
      entityManager,
      notificationType,
      userIds,
      cache,
    );

    return await this.createNotificationReceivers(
      entityManager,
      notification,
      receiverIds,
    );
  }

  // --- Collectors -------------------------------------------------------

  // Generic collector for batching notifications for sending
  private collectNotifications<TKey extends string | number>(
    newReceivers: NotificationReceiver[],
    updatedReceivers: NotificationReceiver[],
    notificationMap: { [key: string]: any[] },
    receiverIds: number[],
    options: {
      keyExtractor: (receiver: NotificationReceiver, cache?: Map<number, User>) => TKey | null;
      valueExtractor: (receiver: NotificationReceiver) => any;
      cache?: Map<number, User>;
    },
  ) {
    const allReceivers = [...newReceivers, ...updatedReceivers];

    allReceivers.forEach(nr => {
      const key = options.keyExtractor(nr, options.cache);

      if (key === null) return;

      const keyString = String(key);

      if (!notificationMap[keyString]) {
        notificationMap[keyString] = [];
      }

      notificationMap[keyString].push(options.valueExtractor(nr));
      receiverIds.push(nr.id);
    });
  }

  private collectInAppNotifications(
    newReceivers: NotificationReceiver[],
    updatedReceivers: NotificationReceiver[],
    inAppNotifications: { [userId: number]: NotificationReceiver[] },
    receiverIds: number[],
  ) {
    this.collectNotifications(newReceivers, updatedReceivers, inAppNotifications, receiverIds, {
      keyExtractor: (nr) => nr.userId,
      valueExtractor: (nr) => nr,
    });
  }

  private collectEmailNotifications(
    newReceivers: NotificationReceiver[],
    updatedReceivers: NotificationReceiver[],
    emailNotifications: { [email: string]: Notification[] },
    receiverIds: number[],
    cache: Map<number, User>,
  ) {
    this.collectNotifications(newReceivers, updatedReceivers, emailNotifications, receiverIds, {
      keyExtractor: (nr, cache) => {
        const user = cache?.get(nr.userId);
        if (!user?.email) {
          console.error(`User ${nr.userId} not found in cache or missing email`);
          return null;
        }
        return user.email;
      },
      valueExtractor: (nr) => nr.notification,
      cache,
    });
  }

  // --- Emitters / senders ----------------------------------------------

  /**
   * Send deletion notifications via WebSocket
   */
  private async sendDeletionNotifications(
    deletionNotifications: { [userId: number]: number[] }
  ) {
    if (Object.keys(deletionNotifications).length === 0) return;

    const deleteNotificationDtos = Object.entries(deletionNotifications).map(
      ([userId, notificationReceiverIds]) => ({
        userId: Number(userId),
        notificationReceiverIds,
      }),
    );

    await emitDeleteNotifications(this.notificationsPublisher, deleteNotificationDtos);
  }

  /**
   * Send in-app notifications via WebSocket and mark receivers as notified
   */
  private async sendInAppNotifications(
    inAppNotifications: { [userId: number]: NotificationReceiver[] },
    receiverIds: number[],
  ) {
    if (Object.keys(inAppNotifications).length === 0) return;

    const notificationDtos = Object.entries(inAppNotifications).map(
      ([userId, notificationReceivers]) => ({
        userId: Number(userId),
        notificationReceivers,
      }),
    );

    await emitNewNotifications(this.notificationsPublisher, notificationDtos);

    await this.entityManager.update(
      NotificationReceiver,
      { id: In(receiverIds) },
      { isInAppNotified: true },
    );
  }

  /**
   * Send email notifications and mark receivers as emailed on success
   */
  private async sendEmailNotifications(
    emailNotifications: { [email: string]: Notification[] },
    receiverIds: number[],
  ) {
    if (Object.keys(emailNotifications).length === 0) return;

    const emailNotificationDtos: EmailNotificationDto[] = Object.entries(
      emailNotifications
    ).map(([email, notifications]) => ({
      email,
      notifications,
    }));

    const onSuccess = async () => {
      await this.entityManager.update(
        NotificationReceiver,
        { id: In(receiverIds) },
        { isEmailSent: true },
      );
    };

    const onError = async (err) => {
      console.error('Failed to send email notifications:', err);
    };

    await emitEmailNotifications(
      this.notificationsPublisher,
      emailNotificationDtos,
      onSuccess,
      onError,
    );
  }

  /**
   * Notify connected clients about affected users
   */
  private async sendNotifyClients(affectedUserIds: Set<number>) {
    if (affectedUserIds.size === 0) return;

    const dtos = Array.from(affectedUserIds, userId => ({ userId }));
    await emitNotifyClients(this.notificationsPublisher, dtos);
  }

  // --- Entity Transaction Handlers ------------------------------------

  private buildAdditionalData(transaction: Transaction): {
    transactionId: string;
    network: string;
    groupId?: number;
  } {
    return {
      transactionId: transaction.transactionId,
      network: transaction.mirrorNetwork,
      ...(transaction.groupItem?.groupId
        ? { groupId: transaction.groupItem.groupId }
        : {}),
    };
  }

  private async handleTransactionStatusUpdateNotifications(
    entityManager: EntityManager,
    transaction: Transaction,
    approvers: TransactionApprover[],
    syncType: NotificationType | null,
    emailType: NotificationType | null,
    cache: Map<number, User>,
    keyCache: Map<string, UserKey>,
    deletionNotifications: { [userId: number]: number[] },
    inAppNotifications: { [userId: number]: NotificationReceiver[] },
    inAppReceiverIds: number[],
    emailNotifications: { [email: string]: Notification[] },
    emailReceiverIds: number[],
    affectedUserIds: Set<number>,
    transactionId: number,
  ) {
    try {
      const additionalData = this.buildAdditionalData(transaction);

      if (syncType) {
        const deletedReceiverIds = await this.deleteExistingIndicators(entityManager, transaction);

        deletedReceiverIds.forEach(({ userId, receiverId }) => {
          if (!deletionNotifications[userId]) {
            deletionNotifications[userId] = [];
          }
          deletionNotifications[userId].push(receiverId);
          affectedUserIds.add(userId);
        });

        const newReceivers = await this.createNotificationWithReceivers(
          entityManager,
          transaction,
          approvers,
          syncType,
          additionalData,
          cache,
          keyCache,
        );

        newReceivers.forEach(nr => {
          if (!inAppNotifications[nr.userId]) inAppNotifications[nr.userId] = [];
          inAppNotifications[nr.userId].push(nr);
          inAppReceiverIds.push(nr.id);
          affectedUserIds.add(nr.userId);
        });
      }

      if (emailType) {
        const newReceivers = await this.createNotificationWithReceivers(
          entityManager,
          transaction,
          approvers,
          emailType,
          additionalData,
          cache,
          keyCache,
        );

        this.collectEmailNotifications(
          newReceivers,
          [],
          emailNotifications,
          emailReceiverIds,
          cache,
        );
      }
    } catch (error) {
      console.error(`Error processing notifications for transaction ${transactionId}:`, error);
    }
  }

  private async handleSignerReminderNotifications(
    entityManager: EntityManager,
    transaction: Transaction,
    transactionId: number,
    userIds: Set<number>,
    cache: Map<number, User>,
    isManual: boolean,
    deletionNotifications: { [userId: number]: number[] },
    inAppNotifications: { [userId: number]: NotificationReceiver[] },
    inAppReceiverIds: number[],
    emailNotifications: { [email: string]: Notification[] },
    emailReceiverIds: number[],
  ): Promise<void> {
    const syncType = this.getInAppNotificationType(transaction.status);

    if (syncType) {
      const { newReceivers, updatedReceivers } = await this.processNotificationType(
        entityManager,
        transactionId,
        syncType,
        userIds,
        cache,
      );

      updatedReceivers.forEach(nr => {
        if (!deletionNotifications[nr.userId]) {
          deletionNotifications[nr.userId] = [];
        }
        deletionNotifications[nr.userId].push(nr.id);
      });

      this.collectInAppNotifications(
        newReceivers,
        updatedReceivers,
        inAppNotifications,
        inAppReceiverIds,
      );
    }

    if (isManual) {
      const emailType = this.getEmailNotificationType(transaction.status);
      if (emailType) {
        const { newReceivers, updatedReceivers } = await this.processNotificationType(
          entityManager,
          transactionId,
          emailType,
          userIds,
          cache,
        );

        this.collectEmailNotifications(
          newReceivers,
          updatedReceivers,
          emailNotifications,
          emailReceiverIds,
          cache,
        );
      }
    } else {
      const newReceivers = await this.processReminderEmail(
        entityManager,
        transaction,
        userIds,
        cache,
      );

      this.collectEmailNotifications(
        newReceivers,
        [],
        emailNotifications,
        emailReceiverIds,
        cache,
      );
    }
  }

  private async handleUserRegisteredNotifications(
    entityManager: EntityManager,
    userId: number,
    adminUserIds: Set<number>,
    additionalData: any,
    cache: Map<number, User>,
    inAppNotifications: { [userId: number]: NotificationReceiver[] },
    emailNotifications: { [email: string]: Notification[] },
    inAppReceiverIds: number[],
    emailReceiverIds: number[],
  ): Promise<void> {
    // Get admin users who want in-app notifications (filtered by preferences)
    const inAppReceiverUserIds = await this.filterReceiversByPreferenceForType(
      entityManager,
      NotificationType.USER_REGISTERED,
      adminUserIds,
      cache,
    );

    // Get admin users who want email notifications (filtered by preferences)
    const emailReceiverUserIds = await this.filterReceiversByPreferenceForType(
      entityManager,
      NotificationType.USER_REGISTERED,
      adminUserIds,
      cache,
    );

    // Combine all receivers (union of in-app and email preferences)
    const allReceiverIds = new Set([...inAppReceiverUserIds, ...emailReceiverUserIds]);

    if (allReceiverIds.size === 0) {
      // Nothing to do
      return;
    }

    // Create single notification for both in-app and email
    const notification = await entityManager.save(Notification, {
      type: NotificationType.USER_REGISTERED,
      entityId: userId,
      notificationReceivers: [],
      additionalData,
    });

    // Create receivers for all admins who want either notification type
    const receivers = await entityManager.save(
      NotificationReceiver,
      Array.from(allReceiverIds).map(adminUserId => ({
        notificationId: notification.id,
        userId: adminUserId,
        isRead: false,
        isInAppNotified: inAppReceiverUserIds.includes(adminUserId) ? false : null,
        isEmailSent: emailReceiverUserIds.includes(adminUserId) ? false : null,
        notification,
      })),
    );

    // Separate receivers for in-app vs email delivery
    const inAppReceiverIdSet = new Set(inAppReceiverUserIds);
    const emailReceiverIdSet = new Set(emailReceiverUserIds);

    const inAppReceivers = receivers.filter(r => inAppReceiverIdSet.has(r.userId));
    const emailReceivers = receivers.filter(r => emailReceiverIdSet.has(r.userId));

    // Collect in-app notifications
    this.collectInAppNotifications(
      inAppReceivers,
      [],
      inAppNotifications,
      inAppReceiverIds,
    );

    // Collect email notifications
    this.collectEmailNotifications(
      emailReceivers,
      [],
      emailNotifications,
      emailReceiverIds,
      cache,
    );
  }

  // --- Event Preparation ----------------------------------------------

  private async prepareEventContext(
    events: NotificationEventDto[],
    withDeleted = false
  ) {
    if (events.length === 0) return null;

    const cache = new Map<number, User>();
    const keyCache = new Map<string, UserKey>();

    const transactionIds = events.map(e => e.entityId);
    const transactionMap = await this.fetchTransactionsWithRelations(transactionIds, withDeleted);

    const approversMap = await this.getApproversByTransactionIds(
      this.entityManager,
      transactionIds,
    );

    const deletionNotifications: { [userId: number]: number[] } = {};
    const inAppNotifications: { [userId: number]: NotificationReceiver[] } = {};
    const emailNotifications: { [email: string]: Notification[] } = {};
    const inAppReceiverIds: number[] = [];
    const emailReceiverIds: number[] = [];
    const affectedUserIds = new Set<number>();

    return {
      cache,
      keyCache,
      transactionIds,
      transactionMap,
      approversMap,
      deletionNotifications,
      inAppNotifications,
      emailNotifications,
      inAppReceiverIds,
      emailReceiverIds,
      affectedUserIds,
    };
  }

  // --- Public processors (entry points) --------------------------------

  async processTransactionStatusUpdateNotifications(events: NotificationEventDto[]) {
    const ctx = await this.prepareEventContext(events, true);
    if (!ctx) return;

    const {
      cache,
      keyCache,
      transactionMap,
      approversMap,
      deletionNotifications,
      inAppNotifications,
      emailNotifications,
      inAppReceiverIds,
      emailReceiverIds,
      affectedUserIds,
    } = ctx;

    // Process each event
    for (const { entityId: transactionId } of events) {
      const transaction = transactionMap.get(transactionId);
      const approvers = approversMap.get(transactionId) || [];

      if (transaction.deletedAt && transaction.status !== TransactionStatus.CANCELED) {
        console.error(
          `Soft-deleted transaction ${transactionId} has unexpected status: ${transaction.status} (expected CANCELED)`
        );
        transaction.status = TransactionStatus.CANCELED;
      }

      const syncType = this.getInAppNotificationType(transaction.status);
      const emailType = this.getEmailNotificationType(transaction.status);

      // Single transaction for both notification types
      await this.entityManager.transaction(async entityManager => {
        await this.handleTransactionStatusUpdateNotifications(
          entityManager,
          transaction,
          approvers,
          syncType,
          emailType,
          cache,
          keyCache,
          deletionNotifications,
          inAppNotifications,
          inAppReceiverIds,
          emailNotifications,
          emailReceiverIds,
          affectedUserIds,
          transactionId,
        );
      });
    }

    // Send all notifications in batch
    await this.sendDeletionNotifications(deletionNotifications);
    await this.sendInAppNotifications(inAppNotifications, inAppReceiverIds);
    await this.sendEmailNotifications(emailNotifications, emailReceiverIds);
    await this.sendNotifyClients(affectedUserIds);
  }

  async processTransactionUpdateNotifications(events: NotificationEventDto[]) {
    const ctx = await this.prepareEventContext(events);
    if (!ctx) return;

    const {
      keyCache,
      transactionMap,
      approversMap,
      affectedUserIds, // from ctx
    } = ctx;

    // Process each event
    for (const { entityId: transactionId } of events) {
      const transaction = transactionMap.get(transactionId);
      const approvers = approversMap.get(transactionId) || [];

      const syncType = this.getInAppNotificationType(transaction.status);

      if (syncType) {
        const receiverIds = await this.getNotificationReceiverIds(this.entityManager, transaction, syncType, approvers, keyCache);
        receiverIds.forEach(id => affectedUserIds.add(id));
      }
    }

    await this.sendNotifyClients(affectedUserIds);
  }

  private async processSignerReminders(
    events: NotificationEventDto[],
    isManual: boolean,
  ) {
    const ctx = await this.prepareEventContext(events);
    if (!ctx) return;

    const {
      cache,
      keyCache,
      transactionMap,
      deletionNotifications,
      inAppNotifications,
      emailNotifications,
      inAppReceiverIds,
      emailReceiverIds,
    } = ctx;

    for (const { entityId: transactionId } of events) {
      const transaction = transactionMap.get(transactionId);

      const allKeys = await keysRequiredToSign(
        transaction,
        this.transactionSignatureService,
        this.entityManager,
        false,
        null,
        keyCache,
      );

      // Filter out keys/users that have been soft-deleted to prevent notification failures
      const activeKeys = filterActiveUserKeys(allKeys);

      const userIds = new Set(activeKeys.map(k => k.userId).filter(Boolean));

      if (userIds.size === 0) continue;

      await this.entityManager.transaction(async entityManager => {
        await this.handleSignerReminderNotifications(
          entityManager,
          transaction,
          transactionId,
          userIds,
          cache,
          isManual,
          deletionNotifications,
          inAppNotifications,
          inAppReceiverIds,
          emailNotifications,
          emailReceiverIds,
        );
      });
    }

    await this.sendDeletionNotifications(deletionNotifications);
    await this.sendInAppNotifications(inAppNotifications, inAppReceiverIds);
    await this.sendEmailNotifications(emailNotifications, emailReceiverIds);
  }

  async remindSigners(events: NotificationEventDto[]) {
    return this.processSignerReminders(events, false);
  }

  async remindSignersManual(events: NotificationEventDto[]) {
    return this.processSignerReminders(events, true);
  }

  async processUserRegisteredNotifications(event: NotificationEventDto) {
    const cache = new Map<number, User>();

    const { entityId: userId, additionalData } = event;

    // Fetch the newly registered user
    const registeredUser = await this.entityManager.findOne(User, {
      where: { id: userId },
    });

    if (!registeredUser) {
      console.error(`User ${userId} not found`);
      return;
    }

    // Get all admin users (recipients of the notification)
    const adminUsers = await this.entityManager.find(User, {
      where: { admin: true },
    });

    if (adminUsers.length === 0) {
      console.log('No admin users found to notify');
      return;
    }

    // Populate cache with admin users
    adminUsers.forEach(user => cache.set(user.id, user));

    const adminUserIds = new Set(adminUsers.map(u => u.id));

    // Collect notifications
    const inAppNotifications: { [userId: number]: NotificationReceiver[] } = {};
    const emailNotifications: { [email: string]: Notification[] } = {};
    const inAppReceiverIds: number[] = [];
    const emailReceiverIds: number[] = [];

    await this.entityManager.transaction(async entityManager => {
      await this.handleUserRegisteredNotifications(
        entityManager,
        userId,
        adminUserIds,
        additionalData,
        cache,
        inAppNotifications,
        emailNotifications,
        inAppReceiverIds,
        emailReceiverIds,
      );
    });

    // Send all notifications
    await this.sendInAppNotifications(inAppNotifications, inAppReceiverIds);
    await this.sendEmailNotifications(emailNotifications, emailReceiverIds);
  }
}
