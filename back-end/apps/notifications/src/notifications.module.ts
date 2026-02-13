import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import * as Joi from 'joi';

import {
  AuthProxyModule,
  LoggerModule,
  LoggerMiddleware,
  HealthModule,
  DatabaseModule,
  SchedulerModule,
  NatsModule,
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
    NATS_URL: Joi.string().required(),
    EMAIL_API_HOST: Joi.string().required(),
    EMAIL_API_PORT: Joi.string().required(),
    EMAIL_API_SECURE: Joi.boolean().required(),
    EMAIL_API_USERNAME: Joi.string().optional(),
    EMAIL_API_PASSWORD: Joi.string().optional(),
    SENDER_EMAIL: Joi.string().required(),
    POSTGRES_HOST: Joi.string().required(),
    POSTGRES_PORT: Joi.number().required(),
    POSTGRES_DATABASE: Joi.string().required(),
    POSTGRES_USERNAME: Joi.string().required(),
    POSTGRES_PASSWORD: Joi.string().required(),
    POSTGRES_SYNCHRONIZE: Joi.boolean().required(),
    REDIS_URL: Joi.string().required(),
    REDIS_DEFAULT_TTL_MS: Joi.number().optional(),
    MINIMUM_SUPPORTED_FRONTEND_VERSION: Joi.string().required(),
  }),
});

@Module({
  imports: [
    config,
    DatabaseModule,
    NatsModule.forRoot(),
    LoggerModule,
    EmailModule,
    ReceiverModule,
    WebsocketModule,
    AuthProxyModule,
    HealthModule,
    SchedulerModule.register({ isGlobal: true }),
  ],
  providers: [LoggerMiddleware],
})
export class NotificationsModule {}
