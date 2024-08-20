import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { SendMailOptions } from 'nodemailer';

import { NotificationTypeEmailSubjects } from '@app/common';
import { Notification, NotificationPreferences, NotificationReceiver, User } from '@entities';

import { EmailService } from '../email/email.service';
import { InAppProcessorService } from '../in-app-processor/in-app-processor.service';

@Injectable()
export class FanOutService {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly emailService: EmailService,
    private readonly inAppProcessorService: InAppProcessorService,
  ) {}

  async fanOut(notification: Notification, receivers: NotificationReceiver[]) {
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
    try {
      await this.sendToEmailProcessor(email.emails, notification, email.userIds);
    } catch (error) {
      console.log(error);
    }

    try {
      await this.sendToInAppProcessor(inApp.userIds, notification);
    } catch (error) {
      console.log(error);
    }
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

    const emailReceivers: string[] = [];
    const emailReceiversUserIds: number[] = [];
    const inAppReceivers: number[] = [];

    receivers.forEach(r => {
      const preference = preferences.find(pr => pr.userId === r.userId);
      const user = users.find(u => u.id === r.userId);

      if (preference ? preference.email : true) {
        emailReceivers.push(user.email);
        emailReceiversUserIds.push(user.id);
      }

      if (preference ? preference.inApp : true) {
        inAppReceivers.push(user.id);
      }
    });

    return {
      email: {
        emails: emailReceivers,
        userIds: emailReceiversUserIds,
      },
      inApp: {
        userIds: inAppReceivers,
      },
    };
  }

  private async sendToEmailProcessor(
    emails: string[],
    notification: Notification,
    userIds: number[],
  ) {
    if (emails.length > 0) {
      const mailOptions: SendMailOptions = {
        from: '"Transaction Tool" info@transactiontool.com',
        to: emails,
        subject: NotificationTypeEmailSubjects[notification.type],
        text: notification.content,
      };

      await this.emailService.processEmail(mailOptions);
      await this.updateIsEmailSent(notification.id, userIds, true);
    }
  }

  private async sendToInAppProcessor(userIds: number[], notification: Notification) {
    if (userIds.length > 0) {
      this.inAppProcessorService.processNotification(notification, userIds);
      await this.updateIsInAppNotified(notification.id, userIds, true);
    }
  }

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
