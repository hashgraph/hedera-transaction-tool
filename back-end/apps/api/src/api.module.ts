import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { Module } from '@nestjs/common';

import * as Joi from 'joi';

import { DatabaseModule, LoggerModule, NotificationsProxyModule, HealthModule } from '@app/common';

import getEnvFilePaths from './config/envFilePaths';

import { IpThrottlerGuard } from './guards';

import { EmailThrottlerModule, IpThrottlerModule } from './modules';

import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UserKeysModule } from './user-keys/user-keys.module';
import { UsersModule } from './users/users.module';
import { NotificationPreferencesModule } from './notification-preferences/notification-preferences.module';

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
    RABBITMQ_URI: Joi.string().required(),
    JWT_SECRET: Joi.string().required(),
    JWT_EXPIRATION: Joi.number().required(),
    OTP_SECRET: Joi.string().required(),
    OTP_EXPIRATION: Joi.number().required(),
    REDIS_URL: Joi.string().required(),
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
    NotificationPreferencesModule,
    NotificationsProxyModule,
    HealthModule,
    IpThrottlerModule,
    EmailThrottlerModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: IpThrottlerGuard,
    },
  ],
})
export class ApiModule {}
