import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';
import { UserKeysModule } from './user-keys/user-keys.module';
import { AuthModule } from './auth/auth.module';
import { TransactionsModule } from './transactions/transactions.module';
import { PingModule } from './ping/ping.module';
import { DatabaseModule, LoggerModule } from '@app/common';
import * as Joi from 'joi';
import { ConfigModule } from '@nestjs/config';
import { NotificationsClientsModule } from './modules/notifications-clients.module';

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
        RABBITMQ_URI: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.number().required(),
        OTP_SECRET: Joi.string().required(),
        OTP_EXPIRATION: Joi.number().required(),
        HEDERA_NETWORK: Joi.string().required(),
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
