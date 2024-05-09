import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';

import { Logger } from 'nestjs-pino';

import { ChainModule } from './chain.module';

async function bootstrap() {
  const app = await NestFactory.create(ChainModule);
  app.useLogger(app.get(Logger));

  const configService = app.get(ConfigService);
  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
      queue: 'chain',
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  await app.startAllMicroservices();
  await app.init();
}
bootstrap();
