import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import * as Joi from 'joi';

import { ApiProxyModule, AuthProxyModule, LoggerModule } from '@app/common';

import { WebsocketModule } from './websocket/websocket.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from '@app/common/health';

@Module({
  imports: [
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
      }),
    }),
    EmailModule,
    LoggerModule,
    WebsocketModule,
    ApiProxyModule,
    AuthProxyModule,
    HealthModule,
  ],
})
export class NotificationsModule {}
