import { Injectable } from '@nestjs/common';
import { BaseNatsConsumerService, ConsumerConfig, MessageHandler } from '../consumer';
import { FanOutService } from './fan-out.service';
import {
  FAN_OUT_DELETE_NOTIFICATIONS,
  FAN_OUT_NEW_NOTIFICATIONS,
  FAN_OUT_NOTIFY_CLIENTS,
  NatsJetStreamService,
} from '@app/common';
import { DeleteNotificationDto, NewNotificationDto, NotifyClientDto } from '../dtos';
import { randomUUID } from 'crypto';

@Injectable()
export class FanOutConsumerService extends BaseNatsConsumerService {
  private readonly consumerName = `FANOUT_CONSUMER_${randomUUID()}`;

  constructor(
    natsService: NatsJetStreamService,
    private readonly fanOutService: FanOutService,
  ) {
    super(natsService, FanOutConsumerService.name);
  }

  protected getConsumerConfig(): ConsumerConfig {
    return {
      streamName: 'NOTIFICATIONS_FANOUT',
      durableName: this.consumerName,
      filterSubject: 'notifications.fanout.>',
    };
  }

  protected getMessageHandlers(): MessageHandler[] {
    return [
      {
        subject: FAN_OUT_NEW_NOTIFICATIONS,
        dtoClass: NewNotificationDto,
        handler: async (data: NewNotificationDto[]) => {
          await this.fanOutService.processNewNotifications(data);
        },
      },
      {
        subject: FAN_OUT_DELETE_NOTIFICATIONS,
        dtoClass: DeleteNotificationDto,
        handler: async (data: DeleteNotificationDto[]) => {
          await this.fanOutService.processDeleteNotifications(data);
        },
      },
      {
        subject: FAN_OUT_NOTIFY_CLIENTS,
        dtoClass: NotifyClientDto,
        handler: async (data: NotifyClientDto[]) => {
          this.logger.log('FAN_OUT_NOTIFY_CLIENTS message received');
          this.logger.log(`Notifying clients with data: ${JSON.stringify(data)}`);
          await this.fanOutService.notifyClients(data);
        },
      },
    ];
  }
}