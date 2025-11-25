import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import * as Joi from 'joi';

import {
  DatabaseModule,
  LoggerMiddleware,
  LoggerModule,
  HealthModule,
  NotificationsProxyModule,
  NatsReconnectService,
} from '@app/common';

import getEnvFilePaths from './config/envFilePaths';

import { ExecuteModule } from './execute';
import { TransactionStatusModule } from './transaction-status/transaction-status.module';

export const config = ConfigModule.forRoot({
  envFilePath: getEnvFilePaths(),
  isGlobal: true,
  validationSchema: Joi.object({
    POSTGRES_HOST: Joi.string().required(),
    POSTGRES_PORT: Joi.number().required(),
    POSTGRES_DATABASE: Joi.string().required(),
    POSTGRES_USERNAME: Joi.string().required(),
    POSTGRES_PASSWORD: Joi.string().required(),
    POSTGRES_SYNCHRONIZE: Joi.boolean().required(),
    NATS_URL: Joi.string().required(),
    REDIS_URL: Joi.string().required(),
    REDIS_DEFAULT_TTL_MS: Joi.number().optional(),
  }),
});

@Module({
  imports: [
    config,
    DatabaseModule,
    LoggerModule,
    ScheduleModule.forRoot(),
    ExecuteModule,
    TransactionStatusModule,
    HealthModule,
    NotificationsProxyModule,
  ],
  providers: [LoggerMiddleware, NatsReconnectService],
})
export class ChainModule {}
