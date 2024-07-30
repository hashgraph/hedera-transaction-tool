import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';

import { CHAIN_SERVICE } from '@app/common';

export function setupApp(app: INestApplication, addLogger: boolean = true) {
  connectMicroservices(app);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (addLogger) {
    app.useLogger(app.get(Logger));
  }
}

function connectMicroservices(app: INestApplication) {
  const configService = app.get(ConfigService);

  app.connectMicroservice({
    transport: Transport.RMQ,
    options: {
      urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
      queue: CHAIN_SERVICE,
    },
  });
}
