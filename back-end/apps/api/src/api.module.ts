import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import * as Joi from 'joi';

import { DatabaseModule, LoggerModule, NotificationsProxyModule } from '@app/common';

import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UserKeysModule } from './user-keys/user-keys.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from '@app/common/health';
import { APP_GUARD } from '@nestjs/core';
import { EmailThrottlerModule, IpThrottlerModule } from './modules';
import { IpThrottlerGuard } from './guards';

@Module({
  imports: [
    DatabaseModule,
    LoggerModule,
    ConfigModule.forRoot({
      envFilePath: ['.env', 'apps/api/.env'],
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
    }),
    UsersModule,
    UserKeysModule,
    AuthModule,
    TransactionsModule,
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
  ]
})
export class ApiModule {}
