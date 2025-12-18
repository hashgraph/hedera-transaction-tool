import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';

import * as Joi from 'joi';

import {
  DatabaseModule,
  LoggerMiddleware,
  LoggerModule,
  NatsModule,
  HealthModule,
  BlacklistModule,
  SchedulerModule,
} from '@app/common';

import getEnvFilePaths from './config/envFilePaths';

import { IpThrottlerGuard } from './guards';

import { EmailThrottlerModule, IpThrottlerModule } from './modules';

import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UserKeysModule } from './user-keys/user-keys.module';
import { UsersModule } from './users/users.module';
import { NotificationPreferencesModule } from './notification-preferences/notification-preferences.module';
import { NotificationReceiverModule } from './notification-receiver/notification-receiver.module';

export const config = ConfigModule.forRoot({
  envFilePath: getEnvFilePaths(),
  isGlobal: true,
  validationSchema: Joi.object({
    HTTP_PORT: Joi.number().required(),
    TCP_PORT: Joi.number().required(),
    POSTGRES_HOST: Joi.string().required(),
    POSTGRES_PORT: Joi.number().required(),
    POSTGRES_DATABASE: Joi.string().required(),
    POSTGRES_USERNAME: Joi.string().required(),
    POSTGRES_PASSWORD: Joi.string().required(),
    POSTGRES_SYNCHRONIZE: Joi.boolean().required(),
    NATS_URL: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRATION: Joi.number().required(),
    OTP_SECRET: Joi.string().required(),
    OTP_EXPIRATION: Joi.number().required(),
    REDIS_URL: Joi.string().required(),
    REDIS_DEFAULT_TTL_MS: Joi.number().optional(),
    LATEST_SUPPORTED_FRONTEND_VERSION: Joi.string().required(),
    MINIMUM_SUPPORTED_FRONTEND_VERSION: Joi.string().required(),
    FRONTEND_REPO_URL: Joi.string().required(),
  }),
});

@Module({
  imports: [
    config,
    DatabaseModule,
    LoggerModule,
    UsersModule,
    UserKeysModule,
    AuthModule,
    TransactionsModule,
    NatsModule.forRoot(),
    NotificationPreferencesModule,
    NotificationReceiverModule,
    HealthModule,
    IpThrottlerModule,
    EmailThrottlerModule,
    BlacklistModule.register({ isGlobal: true }),
    SchedulerModule.register({ isGlobal: true }),
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: IpThrottlerGuard,
    },
    LoggerMiddleware,
  ],
})
export class ApiModule {}
