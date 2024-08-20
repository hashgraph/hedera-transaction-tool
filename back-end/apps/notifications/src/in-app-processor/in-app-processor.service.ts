import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { NOTIFICATIONS_NEW } from '@app/common';
import { Notification, NotificationReceiver } from '@entities';

import { NotificationReceiverDto } from './dtos';

import { WebsocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class InAppProcessorService {
  constructor(private readonly websocket: WebsocketGateway) {}

  processNotification(notification: Notification, receivers: NotificationReceiver[]) {
    if (!receivers || receivers.length === 0) return;

    const userIds = receivers.map(r => r.userId);

    /* Notify users */
    for (const user of userIds) {
      const receiver = receivers.find(r => r.userId === user);
      receiver.notification = notification;

      /* Create DTO from entity */
      const dto = plainToInstance(NotificationReceiverDto, receiver, {
        excludeExtraneousValues: true,
        exposeUnsetFields: false,
      });

      this.websocket.notifyUser(user, NOTIFICATIONS_NEW, dto);
    }
  }
}
