import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';
import { SendMailOptions } from 'nodemailer';

import { NotificationTypeEmailSubjects } from '@app/common';
import { Notification, NotificationPreferences, NotificationReceiver, User } from '@entities';

import { EmailService } from '../email/email.service';

@Injectable()
export class FanOutService {
  constructor(
    @InjectEntityManager() private entityManager: EntityManager,
    private readonly emailService: EmailService,
  ) {}

  async fanOut(notification: Notification, receivers: NotificationReceiver[]) {
    /* If no receivers, nothing to do */
    if (!receivers || receivers.length === 0 || !notification) return;

    /* Ensure all receivers are for this notification */
    receivers = receivers.filter(r => r.notificationId === notification.id);

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

    /* Categorized receivers based on preferences */
    const emailReceivers: string[] = [];
    const inAppReceivers: number[] = [];

    receivers.forEach(r => {
      const preference = preferences.find(pr => pr.userId === r.userId);
      const user = users.find(u => u.id === r.userId);

      if (preference ? preference.email : true) {
        emailReceivers.push(user.email);
      }

      if (preference ? preference.inApp : true) {
        inAppReceivers.push(user.id);
      }
    });

    /* Add to Job queues */
    if (emailReceivers.length > 0) {
      const mailOptions: SendMailOptions = {
        from: '"Transaction Tool" info@transactiontool.com',
        to: emailReceivers,
        subject: NotificationTypeEmailSubjects[notification.type],
        text: notification.content,
      };
      /* Add to email processor queue, but currently it is not in queue */
      await this.emailService.processEmail(
        mailOptions,
        receivers.map(r => r.id),
      );
    }

    if (inAppReceivers.length > 0) {
      console.log('In-app receivers', inAppReceivers);
    }
  }
}
