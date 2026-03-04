import { Injectable } from '@nestjs/common';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { plainToInstance } from 'class-transformer';
import { NOTIFICATIONS_INDICATORS_DELETE, NOTIFICATIONS_NEW, TRANSACTION_ACTION } from '@app/common';
import {
  DeleteNotificationDto,
  NewNotificationDto,
  NotifyClientDto,
  NotificationReceiverDto,
} from '../dtos';

@Injectable()
export class FanOutService {
  constructor(
    private readonly websocket: WebsocketGateway,
  ) {}

  async processNewNotifications(dtos: NewNotificationDto[]) {
    for (const dto of dtos) {
      const newDtos = dto.notificationReceivers.map(receiver =>
        plainToInstance(NotificationReceiverDto, receiver, {
          excludeExtraneousValues: true,
          exposeUnsetFields: false,
        }),
      );

      await this.websocket.notifyUser(dto.userId, NOTIFICATIONS_NEW, newDtos);
    }
  }

  async processDeleteNotifications(dtos: DeleteNotificationDto[]) {
    for (const dto of dtos) {
      await this.websocket.notifyUser(dto.userId, NOTIFICATIONS_INDICATORS_DELETE, {
        notificationReceiverIds: dto.notificationReceiverIds,
      });
    }
  }

  async notifyClients(dtos: NotifyClientDto[]) {
    const groupIds = [...new Set(dtos.map(d => d.groupId).filter(Boolean))];
    await this.websocket.notifyClient({
      message: TRANSACTION_ACTION,
      content: groupIds.length > 0 ? JSON.stringify({ groupIds }) : '',
    });
  }
}
