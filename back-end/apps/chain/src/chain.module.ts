import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

import * as Joi from 'joi';

import {
  DatabaseModule,
  ExecuteModule,
  LoggerMiddleware,
  LoggerModule,
  HealthModule,
  NatsModule,
  SchedulerModule,
} from '@app/common';

import getEnvFilePaths from './config/envFilePaths';

import { ReminderHandlerService } from './transaction-reminder';
import { TransactionSchedulerModule } from './transaction-scheduler';
import { CacheManagementModule } from './cache-management';

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
    CacheManagementModule,
    DatabaseModule,
    LoggerModule,
    NatsModule.forRoot(),
    ScheduleModule.forRoot(),
    SchedulerModule.register({ isGlobal: true }),
    ExecuteModule,
    TransactionSchedulerModule,
    HealthModule,
  ],
  providers: [LoggerMiddleware, ReminderHandlerService],
})
export class ChainModule {}
