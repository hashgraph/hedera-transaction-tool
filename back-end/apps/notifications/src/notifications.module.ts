import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import * as Joi from 'joi';

import { LoggerModule } from '@app/common';
import { ApiProxyModule } from '@app/common/modules/api-proxy.module';

import { WebsocketModule } from './websocket/websocket.module';
import { EmailModule } from './email/email.module';
import { HealthModule } from '@app/common/health';
import { AuthProxyModule } from '@app/common/modules/auth-proxy.module';

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
