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
    const results = await Promise.allSettled(
      dtos.map(dto => {
        const newDtos = dto.notificationReceivers.map(receiver =>
          plainToInstance(NotificationReceiverDto, receiver, {
            excludeExtraneousValues: true,
            exposeUnsetFields: false,
          }),
        );
        return this.websocket.notifyUser(dto.userId, NOTIFICATIONS_NEW, newDtos);
      }),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to notify user ${dtos[index].userId}:`, result.reason);
      }
    });
  }

  async processDeleteNotifications(dtos: DeleteNotificationDto[]) {
    const results = await Promise.allSettled(
      dtos.map(dto =>
        this.websocket.notifyUser(dto.userId, NOTIFICATIONS_INDICATORS_DELETE, {
          notificationReceiverIds: dto.notificationReceiverIds,
        }),
      ),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to notify user ${dtos[index].userId}:`, result.reason);
      }
    });
  }

  async notifyClients(dtos: NotifyClientDto[]) {
    const results = await Promise.allSettled(
      dtos.map(dto =>
        this.websocket.notifyUser(dto.userId, TRANSACTION_ACTION, {
          transactionIds: dto.transactionIds ?? [],
          groupIds: dto.groupIds ?? [],
          eventType: dto.eventType ?? 'unknown',
        }),
      ),
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Failed to notify user ${dtos[index].userId}:`, result.reason);
      }
    });
  }
}
