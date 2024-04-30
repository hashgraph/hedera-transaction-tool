import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import * as Joi from 'joi';

import { LoggerModule } from '@app/common';
import { ApiProxyModule } from '@app/common/modules/api-proxy.module';

import { WebsocketModule } from './websocket/websocket.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['.env', 'apps/notifications/.env'],
      isGlobal: true,
      validationSchema: Joi.object({
        HTTP_PORT: Joi.number().required(),
        RABBITMQ_URI: Joi.string().required(),
        BREVO_USERNAME: Joi.string().required(),
        BREVO_PASSWORD: Joi.string().required(),
      }),
    }),
    EmailModule,
    LoggerModule,
    WebsocketModule,
    ApiProxyModule,
  ],
})
export class NotificationsModule {}
