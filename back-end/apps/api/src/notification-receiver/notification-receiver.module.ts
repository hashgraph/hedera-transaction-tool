import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationReceiver } from '@entities';

import { NotificationsController } from './notification-receiver.controller';
import { NotificationReceiverService } from './notification-receiver.service';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, NotificationReceiver])],
  controllers: [NotificationsController],
  providers: [NotificationReceiverService],
})
export class NotificationReceiverModule {}
