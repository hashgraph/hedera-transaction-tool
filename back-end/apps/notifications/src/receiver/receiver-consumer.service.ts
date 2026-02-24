import { Injectable } from '@nestjs/common';
import { BaseNatsConsumerService, ConsumerConfig, MessageHandler } from '../consumer';
import { ReceiverService } from './receiver.service';
import {
  DismissedNotificationReceiverDto,
  NatsJetStreamService,
  NotificationEventDto,
  DISMISSED_NOTIFICATIONS,
  TRANSACTION_REMIND_SIGNERS,
  TRANSACTION_REMIND_SIGNERS_MANUAL,
  TRANSACTION_STATUS_UPDATE,
  TRANSACTION_UPDATE,
  USER_REGISTERED,
} from '@app/common';

@Injectable()
export class ReceiverConsumerService extends BaseNatsConsumerService {
  constructor(
    natsService: NatsJetStreamService,
    private readonly receiverService: ReceiverService,
  ) {
    super(natsService, ReceiverConsumerService.name);
  }

  protected getConsumerConfig(): ConsumerConfig {
    return {
      streamName: 'NOTIFICATIONS_QUEUE',
      durableName: 'receiver_queue_worker',
      filterSubjects: [
        'notifications.queue.user.>',
        'notifications.queue.transaction.>',
        'notifications.queue.notification.>',
      ],
    };
  }

  protected getMessageHandlers(): MessageHandler[] {
    return [
      {
        subject: TRANSACTION_STATUS_UPDATE,
        dtoClass: NotificationEventDto,
        handler: async (data: NotificationEventDto[]) => {
          await this.receiverService.processTransactionStatusUpdateNotifications(data);
        },
      },
      {
        subject: TRANSACTION_UPDATE,
        dtoClass: NotificationEventDto,
        handler: async (data: NotificationEventDto[]) => {
          await this.receiverService.processTransactionUpdateNotifications(data);
        },
      },
      {
        subject: TRANSACTION_REMIND_SIGNERS,
        dtoClass: NotificationEventDto,
        handler: async (data: NotificationEventDto[]) => {
          await this.receiverService.remindSigners(data);
        },
      },
      {
        subject: TRANSACTION_REMIND_SIGNERS_MANUAL,
        dtoClass: NotificationEventDto,
        handler: async (data: NotificationEventDto[]) => {
          await this.receiverService.remindSignersManual(data);
        },
      },
      {
        subject: USER_REGISTERED,
        dtoClass: NotificationEventDto,
        handler: async (data: NotificationEventDto) => {
          await this.receiverService.processUserRegisteredNotifications(data);
        },
      },
      {
        subject: DISMISSED_NOTIFICATIONS,
        dtoClass: DismissedNotificationReceiverDto,
        handler: async (data: DismissedNotificationReceiverDto[]) => {
          await this.receiverService.processDismissedNotifications(data);
        },
      },
    ];
  }
}
