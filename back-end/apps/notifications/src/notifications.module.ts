import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { LoggerModule } from '@app/common';
import { EmailModule } from './email/email.module';
import { WebsocketModule } from './websocket/websocket.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        RABBITMQ_URI: Joi.string().required(),
        BREVO_USERNAME: Joi.string().required(),
        BREVO_PASSWORD: Joi.string().required(),
      })
    }),
    EmailModule,
    LoggerModule,
    WebsocketModule,
  ],
})
export class NotificationsModule {}
