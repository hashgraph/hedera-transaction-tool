import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import * as Joi from 'joi';

import {
  ApiProxyModule,
  AuthProxyModule,
  LoggerModule,
  HealthModule,
  DatabaseModule,
} from '@app/common';

import { WebsocketModule } from './websocket/websocket.module';
import { EmailModule } from './email/email.module';
import { TransactionNotificationsModule } from './notifications/transactionNotifications.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forRoot({
      envFilePath: ['.env', 'apps/notifications/.env'],
      isGlobal: true,
      validationSchema: Joi.object({
        HTTP_PORT: Joi.number().required(),
        AUTH_HOST: Joi.string().required(),
        AUTH_PORT: Joi.number().required(),
        RABBITMQ_URI: Joi.string().required(),
        BREVO_USERNAME: Joi.string().required(),
        BREVO_PASSWORD: Joi.string().required(),
        POSTGRES_HOST: Joi.string().required(),
        POSTGRES_PORT: Joi.number().required(),
        POSTGRES_DATABASE: Joi.string().required(),
        POSTGRES_USERNAME: Joi.string().required(),
        POSTGRES_PASSWORD: Joi.string().required(),
        POSTGRES_SYNCHRONIZE: Joi.boolean().required(),
        REDIS_URL: Joi.string().required(),
      }),
    }),
    EmailModule,
    TransactionNotificationsModule,
    LoggerModule,
    WebsocketModule,
    ApiProxyModule,
    AuthProxyModule,
    HealthModule,
  ],
})
export class NotificationsModule {}
