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
    for (const dto of dtos) {
      try {
        await this.websocket.notifyUser(dto.userId, TRANSACTION_ACTION, {
          transactionIds: dto.transactionIds ?? [],
          groupIds: dto.groupIds ?? [],
          eventType: dto.eventType ?? 'unknown',
        });
      } catch (error) {
        console.error(`Failed to notify user ${dto.userId}:`, error);
      }
    }
  }
}
