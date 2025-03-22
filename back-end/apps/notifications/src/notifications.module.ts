import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import * as Joi from 'joi';

import {
  ApiProxyModule,
  AuthProxyModule,
  LoggerModule,
  LoggerMiddleware,
  HealthModule,
  DatabaseModule,
  SchedulerModule,
} from '@app/common';

import getEnvFilePaths from './config/envFilePaths';

import { WebsocketModule } from './websocket/websocket.module';
import { EmailModule } from './email/email.module';
import { ReceiverModule } from './receiver/receiver.module';

export const config = ConfigModule.forRoot({
  envFilePath: getEnvFilePaths(),
  isGlobal: true,
  validationSchema: Joi.object({
    HTTP_PORT: Joi.number().required(),
    AUTH_HOST: Joi.string().required(),
    AUTH_PORT: Joi.number().required(),
    RABBITMQ_URI: Joi.string().required(),
    EMAIL_API_HOST: Joi.string().required(),
    EMAIL_API_PORT: Joi.string().required(),
    EMAIL_API_SECURE: Joi.boolean().required(),
    EMAIL_API_USERNAME: Joi.string().required(),
    EMAIL_API_PASSWORD: Joi.string().required(),
    SENDER_EMAIL: Joi.string().required(),
    POSTGRES_HOST: Joi.string().required(),
    POSTGRES_PORT: Joi.number().required(),
    POSTGRES_DATABASE: Joi.string().required(),
    POSTGRES_USERNAME: Joi.string().required(),
    POSTGRES_PASSWORD: Joi.string().required(),
    POSTGRES_SYNCHRONIZE: Joi.boolean().required(),
    REDIS_URL: Joi.string().required(),
    REDIS_DEFAULT_TTL_MS: Joi.number().optional(),
  }),
});

@Module({
  imports: [
    config,
    DatabaseModule,
    EmailModule,
    ReceiverModule,
    LoggerModule,
    WebsocketModule,
    ApiProxyModule,
    AuthProxyModule,
    HealthModule,
    SchedulerModule.register({ isGlobal: true }),
  ],
  providers: [LoggerMiddleware],
})
export class NotificationsModule {}
