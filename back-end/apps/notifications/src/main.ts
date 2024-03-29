import { NestFactory } from '@nestjs/core';
import { NotificationsModule } from './notifications.module';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(NotificationsModule);
  const configService = app.get(ConfigService);
  app.connectMicroservice({
    transport: Transport.TCP,
    options: {
      host: '0.0.0.0',
      port: configService.get<string>('TCP_PORT'),
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Only saves values from the body that are listed in the dtos
    }),
  );
  app.useLogger(app.get(Logger));
  await app.startAllMicroservices();
}
bootstrap();
