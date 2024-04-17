import { ConfigModule } from '@nestjs/config';
import { Module } from '@nestjs/common';

import * as Joi from 'joi';

import { DatabaseModule, LoggerModule, NotificationsClientsModule } from '@app/common';

import { AuthModule } from './auth/auth.module';
import { PingModule } from './ping/ping.module';
import { TransactionsModule } from './transactions/transactions.module';
import { UserKeysModule } from './user-keys/user-keys.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    DatabaseModule,
    LoggerModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        HTTP_PORT: Joi.number().required(),
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_DATABASE: Joi.string().required(),
        POSTGRES_USERNAME: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_SYNCHRONIZE: Joi.boolean().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.number().required(),
        OTP_SECRET: Joi.string().required(),
        OTP_EXPIRATION: Joi.number().required(),
      }),
    }),
    UsersModule,
    UserKeysModule,
    AuthModule,
    TransactionsModule,
    PingModule,
    NotificationsClientsModule,
  ],
})
export class ApiModule {}
