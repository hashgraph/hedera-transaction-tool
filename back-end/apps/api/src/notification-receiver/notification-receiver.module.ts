import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MirrorNodeModule, NotificationsProxyModule } from '@app/common';
import { NotificationReceiver } from '@entities';

import { TransactionsModule } from '../transactions/transactions.module';

import { NotificationsController } from './notification-receiver.controller';
import { NotificationReceiverService } from './notification-receiver.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationReceiver]),
    TransactionsModule,
    MirrorNodeModule,
    NotificationsProxyModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationReceiverService],
})
export class NotificationReceiverModule {}
