import { Injectable } from '@nestjs/common';
import { InjectEntityManager } from '@nestjs/typeorm';
import { EntityManager, In } from 'typeorm';

import { Notification, NotificationPreferences, NotificationReceiver } from '@entities';

@Injectable()
export class FanOutService {
  constructor(@InjectEntityManager() private entityManager: EntityManager) {}

  async fanOut(notification: Notification, receivers: NotificationReceiver[]) {
    /* If no receivers, nothing to do */
    if (!receivers || receivers.length === 0 || !notification) return;

    /* Ensure all receivers are for this notification */
    receivers = receivers.filter(r => r.notificationId === notification.id);

    const userIds = receivers.map(r => r.userId);

    /* Fetch preferences for users for the type of notification */
    const preferences = await this.entityManager.find(NotificationPreferences, {
      where: {
        type: notification.type,
        userId: In(userIds),
      },
    });

    const emailReceivers: NotificationReceiver[] = [];
    const inAppReceivers: NotificationReceiver[] = [];

    /* Categorized receivers based on preferences */
    receivers.forEach(r => {
      const preference = preferences.find(pr => pr.userId === r.userId);
      console.log(preference);

      if (preference ? preference.email : true) {
        emailReceivers.push(r);
      }

      if (preference ? preference.inApp : true) {
        inAppReceivers.push(r);
      }
    });

    console.log('Email receivers', emailReceivers);
    console.log('In-app receivers', inAppReceivers);
  }
}
