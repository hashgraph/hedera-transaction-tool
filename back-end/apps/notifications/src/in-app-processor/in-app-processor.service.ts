import { Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';

import { NOTIFICATIONS_NEW } from '@app/common';
import { Notification } from '@entities';

import { WebsocketGateway } from '../websocket/websocket.gateway';
import { NotificationDto } from './dtos';

@Injectable()
export class InAppProcessorService {
  constructor(private readonly websocket: WebsocketGateway) {}

  processNotification(notification: Notification, userIds: number[]) {
    /* Create DTO from entity */
    const dto = plainToInstance(NotificationDto, notification, {
      excludeExtraneousValues: true,
      exposeUnsetFields: false,
    });

    /* Notify users */
    for (const user of userIds) {
      this.websocket.notifyUser(user, NOTIFICATIONS_NEW, dto);
    }
  }
}
