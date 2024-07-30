import { Module } from '@nestjs/common';

import { LoggerModule, MirrorNodeModule } from '@app/common';

import { TransactionNotificationsController } from './transactionNotifications.controller';
import { TransactionNotificationsService } from './tranasctionNotifications.service';

@Module({
  imports: [LoggerModule, MirrorNodeModule],
  controllers: [TransactionNotificationsController],
  providers: [TransactionNotificationsService],
})
export class TransactionNotificationsModule {}
