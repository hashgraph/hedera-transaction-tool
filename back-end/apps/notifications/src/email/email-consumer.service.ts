import { Injectable } from '@nestjs/common';
import { BaseNatsConsumerService, ConsumerConfig, MessageHandler } from '../consumer';
import { EmailService } from './email.service';
import {
  EMAIL_NOTIFICATIONS,
  EmailDto,
  NatsJetStreamService,
  USER_INVITE,
  USER_PASSWORD_RESET,
} from '@app/common';
import { EmailNotificationDto } from '../dtos';

@Injectable()
export class EmailConsumerService extends BaseNatsConsumerService {
  constructor(
    natsService: NatsJetStreamService,
    private readonly emailService: EmailService,
  ) {
    super(natsService, EmailConsumerService.name);
  }

  protected getConsumerConfig(): ConsumerConfig {
    return {
      streamName: 'NOTIFICATIONS_QUEUE',
      durableName: 'email_queue_worker',
      filterSubjects: [
        'notifications.queue.email',
        'notifications.queue.email.>',
      ],
    };
  }

  protected getMessageHandlers(): MessageHandler[] {
    return [
      {
        subject: USER_INVITE,
        dtoClass: EmailDto,
        handler: async (data: EmailDto[]) => {
          await this.emailService.processUserInviteNotifications(data);
        },
      },
      {
        subject: USER_PASSWORD_RESET,
        dtoClass: EmailDto,
        handler: async (data: EmailDto[]) => {
          await this.emailService.processUserPasswordResetNotifications(data);
        },
      },
      {
        subject: EMAIL_NOTIFICATIONS,
        dtoClass: EmailNotificationDto,
        handler: async (data: EmailNotificationDto | EmailNotificationDto[]) => {
          const notifications = Array.isArray(data) ? data : [data];
          await this.emailService.processEmails(notifications);
        },
      },
    ];
  }
}
