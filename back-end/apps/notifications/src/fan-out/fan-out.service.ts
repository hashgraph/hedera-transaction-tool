import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { SendMailOptions } from 'nodemailer';

import { NotificationTypeEmailSubjects } from '@app/common';
import {
  Notification,
  NotificationPreferences,
  NotificationReceiver,
  NotificationType,
  User,
} from '@entities';

import { EmailService } from '../email/email.service';
import { InAppProcessorService } from '../in-app-processor/in-app-processor.service';

@Injectable()
export class FanOutService {
  emailBlacklistTypes = [
    NotificationType.TRANSACTION_INDICATOR_EXECUTABLE,
    NotificationType.TRANSACTION_INDICATOR_APPROVE,
    NotificationType.TRANSACTION_INDICATOR_SIGN,
    NotificationType.TRANSACTION_INDICATOR_EXECUTED,
    NotificationType.TRANSACTION_INDICATOR_EXPIRED,
    NotificationType.TRANSACTION_INDICATOR_ARCHIVED,
    NotificationType.TRANSACTION_EXPIRED,
  ];

  inAppBlacklistTypes = [
    NotificationType.TRANSACTION_READY_FOR_EXECUTION,
    NotificationType.TRANSACTION_EXECUTED,
    NotificationType.TRANSACTION_CANCELLED,
    NotificationType.TRANSACTION_EXPIRED,
    NotificationType.TRANSACTION_CREATED,
    NotificationType.TRANSACTION_WAITING_FOR_SIGNATURES,
  ];

  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly emailService: EmailService,
    private readonly inAppProcessorService: InAppProcessorService,
  ) {}

  async fanOutNew(notification: Notification, receivers: NotificationReceiver[]) {
    /* If no receivers, nothing to do */
    if (!receivers || receivers.length === 0 || !notification) return;

    /* Ensure all receivers are for this notification */
    receivers = receivers.filter(r => r.notificationId === notification.id);

    /* Categorized receivers based on preferences */
    const { email, inApp } = await this.categorizeReceivers(notification, receivers);

    /* Mark isEmailSent false to receivers who should receive email */
    await this.updateIsEmailSent(notification.id, email.userIds, false);

    /* Mark isInAppNotified false to receivers who should receive in-app notification */
    await this.updateIsInAppNotified(notification.id, inApp.userIds, false);

    /* Process notifications */
    const res = await Promise.allSettled([
      this.sendNewToEmailProcessor(email.emails, notification, email.userIds),
      this.sendNewToInAppProcessor(notification, inApp.receivers),
    ]);

    res.forEach(r => {
      if (r.status === 'rejected') {
        console.error(r.reason);
      }
    });
  }

  async fanOutIndicatorsDelete(userIdToNotificationReceiversId: { [userId: number]: number[] }) {
    this.inAppProcessorService.processNotificationDelete(userIdToNotificationReceiversId);
  }

  private async categorizeReceivers(notification: Notification, receivers: NotificationReceiver[]) {
    /* Get users */
    const userIds = receivers.map(r => r.userId);
    const users = await this.entityManager.find(User, {
      where: {
        id: In(userIds),
      },
    });

    /* Fetch preferences for users for the type of notification */
    const preferences = await this.entityManager.find(NotificationPreferences, {
      where: {
        type: notification.type,
        userId: In(userIds),
      },
    });

    const emails: string[] = [];
    const emailReceivers: NotificationReceiver[] = [];
    const inAppReceivers: NotificationReceiver[] = [];

    receivers.forEach(r => {
      const preference = preferences.find(pr => pr.userId === r.userId);
      const user = users.find(u => u.id === r.userId);

      if (preference ? preference.email : true) {
        emails.push(user.email);
        emailReceivers.push(r);
      }

      if (preference ? preference.inApp : true) {
        inAppReceivers.push(r);
      }
    });

    return {
      email: {
        emails: emails,
        userIds: emailReceivers.map(r => r.userId),
        receivers: emailReceivers,
      },
      inApp: {
        userIds: inAppReceivers.map(r => r.userId),
        receivers: inAppReceivers,
      },
    };
  }

  /* Send to Processors */
  private async sendNewToEmailProcessor(
    emails: string[],
    notification: Notification,
    userIds: number[],
  ) {
    /* If notification type is in blacklist, do not send email */
    if (this.emailBlacklistTypes.includes(notification.type)) return;

    if (emails.length > 0) {
      const mailOptions: SendMailOptions = {
        from: '"Transaction Tool" no-reply@hederatransactiontool.com',
        to: emails,
        subject: NotificationTypeEmailSubjects[notification.type],
        text: notification.content,
      };

      await this.emailService.processEmail(mailOptions);
      await this.updateIsEmailSent(notification.id, userIds, true);
    }
  }

  private async sendNewToInAppProcessor(
    notification: Notification,
    receivers: NotificationReceiver[],
  ) {
    if (receivers && receivers.length > 0) {
      const userIds = receivers.map(r => r.userId);
      /* If notification type is in blacklist, do not send in-app notification */
      if (this.inAppBlacklistTypes.includes(notification.type)) {
        await this.updateIsInAppNotified(notification.id, userIds, null);
      } else {
        this.inAppProcessorService.processNewNotification(notification, receivers);
        await this.updateIsInAppNotified(notification.id, userIds, true);
      }
    }
  }

  /* Database utilities */
  private async updateIsEmailSent(notificationId: number, userIds: number[], isEmailSent: boolean) {
    if (userIds && userIds.length > 0) {
      await this.entityManager.update(
        NotificationReceiver,
        {
          notificationId,
          userId: In(userIds),
        },
        { isEmailSent },
      );
    }
  }

  private async updateIsInAppNotified(
    notificationId: number,
    userIds: number[],
    isInAppNotified: boolean,
  ) {
    if (userIds && userIds.length > 0) {
      await this.entityManager.update(
        NotificationReceiver,
        {
          notificationId,
          userId: In(userIds),
        },
        { isInAppNotified },
      );
    }
  }
}
