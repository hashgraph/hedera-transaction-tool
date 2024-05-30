import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import * as Joi from 'joi';

import { DatabaseModule, LoggerModule, HealthModule, NotificationsProxyModule } from '@app/common';

import { ExecuteModule } from './execute';
import { TransactionStatusModule } from './transaction-status/transaction-status.module';

@Module({
  imports: [
    DatabaseModule,
    LoggerModule,
    ConfigModule.forRoot({
      envFilePath: ['.env', 'apps/chain/.env'],
      isGlobal: true,
      validationSchema: Joi.object({
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_DATABASE: Joi.string().required(),
        POSTGRES_USERNAME: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_SYNCHRONIZE: Joi.boolean().required(),
        RABBITMQ_URI: Joi.string().required(),
        REDIS_URL: Joi.string().required(),
      }),
    }),
    ScheduleModule.forRoot(),
    ExecuteModule,
    TransactionStatusModule,
    HealthModule,
    NotificationsProxyModule,
  ],
})
export class ChainModule {}
