import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NotificationReceiver } from '@entities';

import { TransactionsModule } from '../transactions/transactions.module';

import { NotificationsController } from './notification-receiver.controller';
import { NotificationReceiverService } from './notification-receiver.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotificationReceiver]),
    TransactionsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationReceiverService],
})
export class NotificationReceiverModule {}
