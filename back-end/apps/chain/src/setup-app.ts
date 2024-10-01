import { INestApplication, ValidationPipe, ConsoleLogger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Transport } from '@nestjs/microservices';

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
    app.useLogger(app.get(ConsoleLogger));
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
